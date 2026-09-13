import os
import logging
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, create_access_token,
    jwt_required, get_jwt_identity, verify_jwt_in_request
)
from flask_bcrypt import Bcrypt
from flask_cors import CORS
from datetime import datetime, timezone, timedelta
from functools import wraps
import pickle, json, numpy as np, pandas as pd
from bs4 import BeautifulSoup
import re
import time
import hashlib
import warnings
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

# ============================================================
# LOGGING — [A12] Logging structuré au lieu de print()
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('AutoEstimate')

# ============================================================
# INITIALISATION
# ============================================================
app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI']  = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# [A1] Clé JWT depuis variable d'environnement — OBLIGATOIRE en prod
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'DEV_ONLY_CHANGE_ME_IN_PRODUCTION_32+')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

if app.config['JWT_SECRET_KEY'].startswith('DEV_ONLY'):
    logger.warning("⚠️  JWT_SECRET_KEY non définie — utilisation de la clé de développement. "
                   "Définissez JWT_SECRET_KEY en variable d'environnement pour la production !")

db  = SQLAlchemy(app)
jwt = JWTManager(app)
bcrypt = Bcrypt(app)

# ============================================================
# CHARGEMENT DU MODÈLE v2 (Stacking XGBoost + RF → Ridge)
# ============================================================
model    = pickle.load(open('model_final.pkl',  'rb'))
scaler   = pickle.load(open('scaler_v2.pkl',    'rb'))
features = pickle.load(open('features_v2.pkl',  'rb'))

# [A3] model_to_brand chargé UNE SEULE FOIS au démarrage
with open('model_to_brand.pkl', 'rb') as f:
    MODEL_TO_BRAND = pickle.load(f)

# Colonnes numériques à scaler
NUMERICAL_FEATURES = ['Année-Modèle', 'Kilométrage', 'Puissance fiscale', 'Age', 'Km_par_an']

# [A13] datetime.now(timezone.utc) au lieu de datetime.utcnow()
CURRENT_YEAR = datetime.now(timezone.utc).year

# [A2] Liste des colonnes d'équipements pour calculer Score_equipements
EQUIPEMENTS_COLS = [f for f in features if f in [
    'Climatisation', 'Système de navigation/GPS', 'Caméra de recul',
    'Jantes aluminium', 'Toit ouvrant', 'Sièges cuir', 'Radar de recul',
    'Vitres électriques', 'Verrouillage centralisé à distance',
    'Régulateur de vitesse', 'ABS', 'Airbags', 'CD/MP3/Bluetooth',
    'ESP', 'Limiteur de vitesse', 'Ordinateur de bord'
]]

# [A8] Prix plancher et plafond
PRIX_MIN = 5_000
PRIX_MAX = 5_000_000

# ============================================================
# [A5] RATE LIMITING — simple en mémoire
# ============================================================
_rate_limit_store = {}
RATE_LIMIT_PREDICT  = 30   # requêtes/min pour /predict
RATE_LIMIT_ANALYZE  = 5    # requêtes/min pour /analyze-link

def check_rate_limit(key, max_requests):
    """Vérifie le rate limit. Retourne True si autorisé."""
    now = time.time()
    if key not in _rate_limit_store:
        _rate_limit_store[key] = []
    _rate_limit_store[key] = [t for t in _rate_limit_store[key] if now - t < 60]
    if len(_rate_limit_store[key]) >= max_requests:
        return False
    _rate_limit_store[key].append(now)
    return True

# ============================================================
# [A9] CACHE — scraping Avito (TTL 1h)
# ============================================================
_scrape_cache = {}
CACHE_TTL = 3600

def get_cached_scrape(url):
    url_hash = hashlib.md5(url.encode()).hexdigest()
    entry = _scrape_cache.get(url_hash)
    if entry and (time.time() - entry['timestamp']) < CACHE_TTL:
        logger.info(f"Cache HIT pour {url[:60]}...")
        return entry['data']
    return None

def set_scrape_cache(url, data):
    url_hash = hashlib.md5(url.encode()).hexdigest()
    _scrape_cache[url_hash] = {'data': data, 'timestamp': time.time()}
    if len(_scrape_cache) > 100:
        oldest_key = min(_scrape_cache, key=lambda k: _scrape_cache[k]['timestamp'])
        del _scrape_cache[oldest_key]

# ============================================================
# MODÈLES DE BASE DE DONNÉES
# ============================================================
class User(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    username     = db.Column(db.String(80),  unique=True, nullable=False)
    email        = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    is_admin     = db.Column(db.Boolean, default=False)
    created_at   = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

class PredictionHistory(db.Model):
    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    input_data     = db.Column(db.Text, nullable=False)
    predicted_price = db.Column(db.Float, nullable=False)
    created_at     = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    description    = db.Column(db.String(200))
    # [A16] Champs dédiés marque/modèle
    marque         = db.Column(db.String(100), default='')
    modele         = db.Column(db.String(100), default='')

# ============================================================
# DÉCORATEUR ADMIN
# ============================================================
def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user_id = int(get_jwt_identity())
        user = db.session.get(User, user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Accès administrateur requis'}), 403
        return fn(*args, **kwargs)
    return wrapper

# ============================================================
# [A7] VALIDATION DES ENTRÉES
# ============================================================
def valider_input_prediction(data):
    """Valide les données d'entrée pour /predict."""
    if not isinstance(data, dict):
        return False, "Les données doivent être un objet JSON"

    validations = {
        'Année-Modèle':      (1970, CURRENT_YEAR + 1, "Année-Modèle"),
        'Kilométrage':       (0, 2_000_000, "Kilométrage"),
        'Puissance fiscale': (1, 100, "Puissance fiscale"),
        'Nombre de portes':  (2, 7, "Nombre de portes"),
        'État':              (0, 6, "État"),
        'Boite de vitesses': (0, 1, "Boite de vitesses"),
    }

    for col, (val_min, val_max, label) in validations.items():
        if col in data:
            try:
                val = float(data[col])
                if val < val_min or val > val_max:
                    return False, f"{label} doit être entre {val_min} et {val_max}"
            except (ValueError, TypeError):
                return False, f"{label} doit être un nombre valide"

    return True, None

# ============================================================
# UTILITAIRES ML
# ============================================================
def preparer_input(data_dict):
    """
    Transforme un dictionnaire de features en DataFrame prêt pour la prédiction.
    Calcule Age, Km_par_an et Score_equipements, puis applique le scaler.
    """
    df = pd.DataFrame([np.zeros(len(features))], columns=features)

    for col, val in data_dict.items():
        if col in df.columns:
            df[col] = val

    annee = float(df['Année-Modèle'].iloc[0]) if df['Année-Modèle'].iloc[0] != 0 else 2015
    km    = float(df['Kilométrage'].iloc[0])
    age   = max(CURRENT_YEAR - annee, 0)
    df['Age']       = age
    df['Km_par_an'] = km / (age + 1)

    # [A2] Calcul du Score_equipements
    if 'Score_equipements' in df.columns:
        df['Score_equipements'] = sum(
            float(df[col].iloc[0]) for col in EQUIPEMENTS_COLS if col in df.columns
        )

    df[NUMERICAL_FEATURES] = scaler.transform(df[NUMERICAL_FEATURES])
    return df

def predire_prix(df_input):
    """[A8] Prédit le prix avec bornes min/max."""
    prix_brut = float(model.predict(df_input)[0])
    return round(max(PRIX_MIN, min(prix_brut, PRIX_MAX)), 2)

def sauvegarder_historique(user_id, input_data, prix_predit, description="", marque="", modele=""):
    """Sauvegarde une prédiction dans l'historique."""
    try:
        entree = PredictionHistory(
            user_id=user_id,
            input_data=json.dumps(input_data, ensure_ascii=False),
            predicted_price=round(prix_predit, 2),
            description=description,
            marque=marque,
            modele=modele
        )
        db.session.add(entree)
        db.session.commit()
        logger.info(f"Historique sauvegardé: user={user_id}, prix={prix_predit:.0f}, desc={description}")
    except Exception as e:
        logger.error(f"Erreur sauvegarde historique : {e}")
        db.session.rollback()

# [A11] Extraction marque/modèle depuis le payload one-hot
def extraire_marque_modele(data):
    """Extrait les noms de marque et modèle depuis un dictionnaire de features one-hot."""
    marque = ''
    modele = ''
    for k, v in data.items():
        if v == 1 or v is True:
            if k.startswith('Marque_'):
                marque = k.replace('Marque_', '')
            elif k.startswith('Modèle_'):
                modele = k.replace('Modèle_', '')
    return marque, modele

# [A18] Intervalle de confiance
def estimer_fourchette(prix_estime):
    """Fourchette ±MAE autour du prix estimé."""
    MAE = 15_200
    return max(PRIX_MIN, round(prix_estime - MAE, 2)), round(prix_estime + MAE, 2)

# ============================================================
# SCRAPING AVITO — Selenium (structure 2025)
# ============================================================

def _get_chrome_driver():
    opts = Options()
    opts.add_argument('--headless')
    opts.add_argument('--no-sandbox')
    opts.add_argument('--disable-dev-shm-usage')
    opts.add_argument('--disable-gpu')
    opts.add_argument('--window-size=1920,1080')
    opts.add_argument(
        'user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    opts.add_experimental_option('excludeSwitches', ['enable-logging'])
    return webdriver.Chrome(options=opts)


def scrape_annonce(url):
    """
    Scrape une annonce Avito avec Selenium.
    [A6] Gestion robuste du driver
    [A10] Timeout global 60s
    """
    driver = None
    try:
        driver = _get_chrome_driver()
        driver.set_page_load_timeout(60)  # [A10]
        driver.get(url)

        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, 'img[src*="adparam"]'))
        )
        time.sleep(1)

        xpath_voir_plus = (
            '//*[contains(text(),"Voir plus") or contains(text(),"voir plus") '
            'or contains(text(),"Plus de détails") or contains(text(),"Afficher plus")]'
        )
        for _ in range(5):
            try:
                boutons = driver.find_elements(By.XPATH, xpath_voir_plus)
                boutons_visibles = [b for b in boutons if b.is_displayed()]
                if not boutons_visibles:
                    break
                driver.execute_script("arguments[0].click();", boutons_visibles[0])
                time.sleep(1)
            except Exception:
                break

        soup = BeautifulSoup(driver.page_source, 'html.parser')

    except TimeoutException:
        logger.warning(f"Timeout scraping {url[:80]}")
        return None, "La page a mis trop de temps à charger (timeout 60s)"
    except Exception as e:
        logger.error(f"Erreur Selenium pour {url[:80]}: {e}")
        return None, f"Erreur lors du chargement de la page : {str(e)}"
    finally:
        # [A6] Fermeture robuste
        if driver:
            try:
                driver.quit()
            except Exception as e:
                logger.warning(f"Erreur fermeture driver : {e}")

    donnees = {}

    mapping_labels = {
        'année-modèle':      'Année-Modèle',
        'année':             'Année-Modèle',
        'kilométrage':       'Kilométrage',
        'puissance fiscale': 'Puissance fiscale',
        'nombre de portes':  'Nombre de portes',
        'état':              'État',
        'boite de vitesses': 'Boite de vitesses',
        'transmission':      'Boite de vitesses',
        'carburant':         'Type de carburant',
        'type de carburant': 'Type de carburant',
        'marque':            'Marque',
        'modèle':            'Modèle',
        'origine':           'Origine',
    }

    # Prix depuis og:title
    og_title = soup.find('meta', property='og:title')
    if og_title:
        m = re.search(r'([\d\s\u202f]+)\s*DH', og_title.get('content', ''))
        if m:
            prix_str = re.sub(r'[^\d]', '', m.group(1))
            if prix_str:
                donnees['prix_annonce'] = int(prix_str)

    # Extraction principale : blocs img+texte
    equipements_scrapes = []

    for img in soup.select('img[src*="adparam"]'):
        bloc = img.find_parent()
        if not bloc:
            continue
        texte_bloc = bloc.get_text(separator='|', strip=True)
        parties = [p.strip() for p in texte_bloc.split('|') if p.strip()]

        if len(parties) == 1:
            equipements_scrapes.append(parties[0])
        elif len(parties) >= 2:
            label_trouve = None
            valeur_trouvee = None
            for nb_label in range(1, len(parties)):
                label_candidat = ' '.join(parties[len(parties)-nb_label:]).lower()
                if label_candidat in mapping_labels:
                    label_trouve = label_candidat
                    valeur_trouvee = ' '.join(parties[:len(parties)-nb_label]).strip()
                    break

            if label_trouve and valeur_trouvee:
                col_name = mapping_labels[label_trouve]
                if col_name not in donnees:
                    donnees[col_name] = valeur_trouvee
            elif len(parties) == 2:
                equipements_scrapes.append(parties[0])

    # Fallback JSON-LD
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            jdata = json.loads(script.string or '')
            if not isinstance(jdata, dict):
                continue
            if jdata.get('@type') not in ('Product', 'Car', 'Offer'):
                continue
            props = {p.get('name', '').lower(): str(p.get('value', ''))
                     for p in jdata.get('additionalProperty', [])}
            for label_key, col_name in mapping_labels.items():
                if label_key in props and col_name not in donnees:
                    donnees[col_name] = props[label_key]
            if not donnees.get('prix_annonce'):
                offers = jdata.get('offers', {})
                if offers.get('price'):
                    try:
                        donnees['prix_annonce'] = int(float(str(offers['price']).replace(' ', '')))
                    except:
                        pass
        except:
            pass

    # Fallback titre → Marque
    if not donnees.get('Marque'):
        title_tag = soup.find('title')
        if title_tag:
            title = title_tag.get_text(strip=True)
            marques_connues = [
                'Renault', 'Dacia', 'Peugeot', 'Citroën', 'Volkswagen', 'Toyota',
                'Hyundai', 'Kia', 'Ford', 'Opel', 'Fiat', 'BMW', 'Mercedes-Benz',
                'Mercedes', 'Audi', 'Seat', 'Skoda', 'Honda', 'Nissan', 'Mazda',
                'Mitsubishi', 'Suzuki', 'Volvo', 'Alfa Romeo', 'Jeep', 'Land Rover',
                'Porsche', 'Chevrolet', 'Dodge', 'Subaru', 'Lexus', 'Infiniti'
            ]
            for marque in marques_connues:
                if marque.lower() in title.lower():
                    donnees['Marque'] = marque
                    break

    if not donnees.get('Marque') and not donnees.get('Année-Modèle'):
        return None, "Impossible d'extraire les données de cette annonce"

    # Équipements
    mapping_icones_eq = {
        'adparam_car_abs':              'ABS',
        'adparam_car_airbags':          'Airbags',
        'adparam_cd_mp3_bt':            'CD/MP3/Bluetooth',
        'adparam_car_reverse_camera':   'Caméra de recul',
        'adparam_car_ac':               'Climatisation',
        'adparam_car_esp':              'ESP',
        'adparam_car_gps':              'Système de navigation/GPS',
        'adparam_car_alloy_wheels':     'Jantes aluminium',
        'adparam_car_sunroof':          'Toit ouvrant',
        'adparam_car_leather':          'Sièges cuir',
        'adparam_car_parking_sensor':   'Radar de recul',
        'adparam_car_electric_windows': 'Vitres électriques',
        'adparam_car_central_lock':     'Verrouillage centralisé à distance',
        'adparam_car_cruise_control':   'Régulateur de vitesse',
        'adparam_car_speed_limiter':    'Limiteur de vitesse',
        'adparam_car_computer':         'Ordinateur de bord',
        'adparam_car_navigation':       'Système de navigation/GPS',
    }

    equipements_connus = list(mapping_icones_eq.values())
    eq_set = set()

    for img in soup.select('img[src*="adparam"]'):
        src = img.get('src', '')
        for cle_icone, nom_eq in mapping_icones_eq.items():
            if cle_icone in src:
                eq_set.add(nom_eq)
                break

    for eq in equipements_scrapes:
        if eq in equipements_connus:
            eq_set.add(eq)

    donnees['Équipements'] = sorted(eq_set)
    return donnees, None


def mapper_features(donnees_scraping):
    """
    Convertit les données brutes du scraping en vecteur de features.
    [A4] Debug prints supprimés — logging uniquement.
    """
    input_dict = {}

    try:
        input_dict['Année-Modèle'] = float(re.sub(r'[^\d]', '', str(donnees_scraping.get('Année-Modèle', 2015))))
    except:
        input_dict['Année-Modèle'] = 2015

    try:
        input_dict['Kilométrage'] = float(re.sub(r'[^\d]', '', str(donnees_scraping.get('Kilométrage', 100000))))
    except:
        input_dict['Kilométrage'] = 100000

    try:
        pf = re.sub(r'[^\d]', '', str(donnees_scraping.get('Puissance fiscale', '7')))
        input_dict['Puissance fiscale'] = float(pf) if pf else 7.0
    except:
        input_dict['Puissance fiscale'] = 7.0

    try:
        input_dict['Nombre de portes'] = int(re.sub(r'[^\d]', '', str(donnees_scraping.get('Nombre de portes', '5'))) or 5)
    except:
        input_dict['Nombre de portes'] = 5

    etat_map = {
        'pour pièces': 0, 'endommagé': 1, 'correct': 2,
        'bon': 3, 'très bon': 4, 'excellent': 5, 'neuf': 6
    }
    etat_raw = str(donnees_scraping.get('État', 'Bon')).lower()
    input_dict['État'] = etat_map.get(etat_raw, 3)

    bv = str(donnees_scraping.get('Boite de vitesses', 'Manuelle')).lower()
    input_dict['Boite de vitesses'] = 1 if 'auto' in bv else 0

    carburant = str(donnees_scraping.get('Type de carburant', ''))
    col_carb = f"Type de carburant_{carburant}"
    if col_carb in features:
        input_dict[col_carb] = 1

    origine = str(donnees_scraping.get('Origine', ''))
    col_orig = f"Origine_{origine}"
    if col_orig in features:
        input_dict[col_orig] = 1

    marque = str(donnees_scraping.get('Marque', ''))
    col_marque = f"Marque_{marque}"
    if col_marque in features:
        input_dict[col_marque] = 1

    modele = str(donnees_scraping.get('Modèle', ''))
    col_modele = f"Modèle_{modele}"
    if col_modele in features:
        input_dict[col_modele] = 1

    for eq in donnees_scraping.get('Équipements', []):
        if eq in features:
            input_dict[eq] = 1

    logger.debug(f"Mapper: marque={marque}, modele={modele}, année={input_dict.get('Année-Modèle')}")
    return input_dict

# ============================================================
# GESTIONNAIRES D'ERREURS
# ============================================================
@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Ressource non trouvée'}), 404

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Erreur interne : {e}")
    return jsonify({'error': 'Erreur interne du serveur'}), 500

# ============================================================
# [A17] HEALTH CHECK
# ============================================================
@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status':    'ok',
        'model':     type(model).__name__,
        'features':  len(features),
        'timestamp': datetime.now(timezone.utc).isoformat()
    }), 200

# ============================================================
# ROUTES — AUTHENTIFICATION
# ============================================================
@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not all(k in data for k in ['username', 'email', 'password']):
        return jsonify({'error': 'username, email et password requis'}), 400

    username = str(data['username']).strip()
    email    = str(data['email']).strip().lower()
    password = str(data['password'])

    if len(username) < 3 or len(username) > 80:
        return jsonify({'error': "Le nom d'utilisateur doit contenir entre 3 et 80 caractères"}), 400
    if not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        return jsonify({'error': 'Email invalide'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Le mot de passe doit contenir au moins 6 caractères'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email déjà utilisé'}), 409
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username déjà utilisé'}), 409

    pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    user = User(username=username, email=email, password_hash=pw_hash)
    db.session.add(user)
    db.session.commit()

    logger.info(f"Nouveau compte créé : {username} ({email})")
    return jsonify({'message': 'Compte créé avec succès'}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Données manquantes'}), 400

    email = str(data.get('email', '')).strip().lower()
    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, data.get('password', '')):
        return jsonify({'error': 'Email ou mot de passe incorrect'}), 401

    token = create_access_token(identity=str(user.id))
    logger.info(f"Connexion réussie : {user.username}")
    return jsonify({
        'token':    token,
        'username': user.username,
        'is_admin': user.is_admin
    }), 200

# [A14] Changement de mot de passe
@app.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'Utilisateur introuvable'}), 404

    data = request.get_json()
    if not data or not all(k in data for k in ['current_password', 'new_password']):
        return jsonify({'error': 'current_password et new_password requis'}), 400

    if not bcrypt.check_password_hash(user.password_hash, data['current_password']):
        return jsonify({'error': 'Mot de passe actuel incorrect'}), 401

    new_password = str(data['new_password'])
    if len(new_password) < 6:
        return jsonify({'error': 'Le nouveau mot de passe doit contenir au moins 6 caractères'}), 400

    user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.session.commit()

    logger.info(f"Mot de passe changé pour {user.username}")
    return jsonify({'message': 'Mot de passe modifié avec succès'}), 200

# ============================================================
# ROUTES — PRÉDICTION
# ============================================================
@app.route('/predict', methods=['POST'])
def predict():
    # [A5] Rate limiting
    client_ip = request.remote_addr
    if not check_rate_limit(f"predict:{client_ip}", RATE_LIMIT_PREDICT):
        return jsonify({'error': 'Trop de requêtes, veuillez réessayer dans une minute'}), 429

    data = request.get_json()
    if not data:
        return jsonify({'error': 'Données manquantes'}), 400

    # [A7] Validation
    valide, erreur_validation = valider_input_prediction(data)
    if not valide:
        return jsonify({'error': erreur_validation}), 400

    df_input = preparer_input(data)
    prix_predit = predire_prix(df_input)
    prix_min, prix_max = estimer_fourchette(prix_predit)

    # Sauvegarder si connecté
    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        if user_id:
            marque, modele_v = extraire_marque_modele(data)
            desc = f"Estimation manuelle — {marque} {modele_v}".strip()
            if desc == "Estimation manuelle —":
                desc = "Estimation manuelle"
            sauvegarder_historique(int(user_id), data, prix_predit, desc, marque, modele_v)
    except Exception as e:
        logger.debug(f"Pas de JWT pour sauvegarde historique : {e}")

    return jsonify({
        'prediction':  prix_predit,
        'prix_estime': prix_predit,
        'prix_min':    prix_min,
        'prix_max':    prix_max,
    }), 200

@app.route('/analyze-link', methods=['POST'])
def analyze_link():
    # [A5] Rate limiting strict
    client_ip = request.remote_addr
    if not check_rate_limit(f"analyze:{client_ip}", RATE_LIMIT_ANALYZE):
        return jsonify({'error': "Trop de requêtes d'analyse, veuillez réessayer dans une minute (max 5/min)"}), 429

    data = request.get_json()
    url  = data.get('url', '').strip()
    if not url or 'avito.ma' not in url:
        return jsonify({'error': 'URL Avito invalide'}), 400

    # [A9] Cache
    cached = get_cached_scrape(url)
    if cached:
        donnees_scraping = cached
        erreur = None
    else:
        donnees_scraping, erreur = scrape_annonce(url)
        if donnees_scraping:
            set_scrape_cache(url, donnees_scraping)

    if erreur:
        return jsonify({'error': erreur}), 422

    input_dict  = mapper_features(donnees_scraping)
    df_input    = preparer_input(input_dict)
    prix_predit = predire_prix(df_input)
    prix_annonce = donnees_scraping.get('prix_annonce')
    prix_min, prix_max = estimer_fourchette(prix_predit)

    analyse = None
    ecart_pct = None
    if prix_annonce:
        ecart_pct = round(((prix_annonce - prix_predit) / prix_predit) * 100, 1)
        if ecart_pct > 10:
            analyse = 'surévalué'
        elif ecart_pct < -10:
            analyse = 'sous-évalué'
        else:
            analyse = 'juste prix'

    try:
        verify_jwt_in_request(optional=True)
        user_id = get_jwt_identity()
        if user_id:
            marque = donnees_scraping.get('Marque', '')
            modele_v = donnees_scraping.get('Modèle', '')
            desc = f"Analyse annonce — {marque} {modele_v}".strip()
            sauvegarder_historique(int(user_id), input_dict, prix_predit, desc, marque, modele_v)
    except:
        pass

    logger.info(f"Analyse: annonce={prix_annonce}, estimé={prix_predit}, verdict={analyse}")

    return jsonify({
        'prix_estime':       round(prix_predit, 2),
        'prix_predit':       round(prix_predit, 2),
        'prix_annonce':      prix_annonce,
        'prix_min':          prix_min,
        'prix_max':          prix_max,
        'ecart_pct':         ecart_pct,
        'analyse':           analyse,
        'details':           donnees_scraping,
        'details_scraped':   {k: v for k, v in donnees_scraping.items() if k not in ('Équipements', 'prix_annonce')},
        'equipements_scraped': donnees_scraping.get('Équipements', [])
    }), 200

# ============================================================
# ROUTES — FORMULAIRE
# ============================================================
@app.route('/form-options', methods=['GET'])
def form_options():
    marque_filtre = request.args.get('marque', None)

    marques    = sorted([c.replace('Marque_', '')    for c in features if c.startswith('Marque_')])
    origines   = sorted([c.replace('Origine_', '')   for c in features if c.startswith('Origine_')])
    carburants = sorted([c.replace('Type de carburant_', '') for c in features if c.startswith('Type de carburant_')])
    NOMS_EQ = [
        ('Climatisation',                      'Climatisation'),
        ('Système de navigation / GPS',         'Système de navigation/GPS'),
        ('Caméra de recul',                    'Caméra de recul'),
        ('Jantes aluminium',                   'Jantes aluminium'),
        ('Toit ouvrant',                       'Toit ouvrant'),
        ('Sièges cuir',                        'Sièges cuir'),
        ('Radar de recul',                     'Radar de recul'),
        ('Vitres électriques',                 'Vitres électriques'),
        ('Verrouillage centralisé à distance', 'Verrouillage centralisé à distance'),
        ('Régulateur de vitesse',              'Régulateur de vitesse'),
        ('ABS',                                'ABS'),
        ('Airbags',                            'Airbags'),
        ('CD / MP3 / Bluetooth',               'CD/MP3/Bluetooth'),
        ('ESP',                                'ESP'),
        ('Limiteur de vitesse',                'Limiteur de vitesse'),
        ('Ordinateur de bord',                 'Ordinateur de bord'),
    ]
    equipements = [
        {'label': lbl, 'column': col}
        for lbl, col in NOMS_EQ if col in features
    ]

    # [A3] Utiliser MODEL_TO_BRAND global
    if marque_filtre and MODEL_TO_BRAND:
        modeles = sorted([
            m for m, b in MODEL_TO_BRAND.items()
            if b == marque_filtre and f"Modèle_{m}" in features
        ])
        if not modeles:
            modeles = sorted([c.replace('Modèle_', '') for c in features if c.startswith('Modèle_')])
    else:
        modeles = sorted([c.replace('Modèle_', '') for c in features if c.startswith('Modèle_')])

    return jsonify({
        'marques':     [{'label': m, 'column': 'Marque_'    + m} for m in marques],
        'modeles':     [{'label': m, 'column': 'Modèle_'    + m} for m in modeles],
        'origines':    [{'label': o, 'column': 'Origine_'   + o} for o in origines],
        'carburants':  [{'label': c, 'column': 'Type de carburant_' + c} for c in carburants],
        'equipements': equipements,
        'boite_column':       'Boite de vitesses',
        'numerical_features': NUMERICAL_FEATURES
    }), 200

# ============================================================
# ROUTES — UTILISATEUR
# ============================================================
@app.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'Utilisateur introuvable'}), 404
    return jsonify({
        'id':         user.id,
        'username':   user.username,
        'email':      user.email,
        'is_admin':   user.is_admin,
        'created_at': user.created_at.isoformat()
    }), 200

@app.route('/history', methods=['GET'])
@jwt_required()
def history():
    user_id = int(get_jwt_identity())
    page    = request.args.get('page', 1, type=int)
    limit   = min(request.args.get('limit', 10, type=int), 50)

    total = PredictionHistory.query.filter_by(user_id=user_id).count()
    entries = (PredictionHistory.query
               .filter_by(user_id=user_id)
               .order_by(PredictionHistory.created_at.desc())
               .offset((page - 1) * limit)
               .limit(limit)
               .all())

    return jsonify({
        'total': total,
        'page':  page,
        'pages': max(1, -(-total // limit)),
        'items': [{
            'id':              e.id,
            'predicted_price': e.predicted_price,
            'description':     e.description,
            'marque':          getattr(e, 'marque', '') or '',
            'modele':          getattr(e, 'modele', '') or '',
            'created_at':      e.created_at.isoformat(),
            'input_data':      json.loads(e.input_data)
        } for e in entries]
    }), 200

@app.route('/history/<int:entry_id>', methods=['DELETE'])
@jwt_required()
def delete_history_entry(entry_id):
    user_id = int(get_jwt_identity())
    entry = PredictionHistory.query.filter_by(id=entry_id, user_id=user_id).first_or_404()
    db.session.delete(entry)
    db.session.commit()
    return jsonify({'message': 'Entrée supprimée'}), 200

# ============================================================
# ROUTES — ADMIN
# ============================================================
@app.route('/admin/stats', methods=['GET'])
@admin_required
def admin_stats():
    predictions = PredictionHistory.query.all()
    prix_list = [p.predicted_price for p in predictions]

    stats = {
        'total_users':       User.query.count(),
        'total_predictions': len(prix_list),
        'admins':            User.query.filter_by(is_admin=True).count(),
        'users_actifs':      db.session.query(PredictionHistory.user_id).distinct().count(),
    }

    if prix_list:
        stats['prix_moyen']  = round(float(np.mean(prix_list)), 0)
        stats['prix_median'] = round(float(np.median(prix_list)), 0)

    return jsonify(stats), 200

@app.route('/admin/users', methods=['GET'])
@admin_required
def admin_users():
    # [A15] Pagination + recherche
    page   = request.args.get('page', 1, type=int)
    limit  = min(request.args.get('limit', 50, type=int), 100)
    search = request.args.get('search', '').strip()

    query = User.query
    if search:
        query = query.filter(
            db.or_(
                User.username.ilike(f'%{search}%'),
                User.email.ilike(f'%{search}%')
            )
        )

    total = query.count()
    users = (query
             .order_by(User.created_at.desc())
             .offset((page - 1) * limit)
             .limit(limit)
             .all())

    return jsonify({
        'total': total,
        'page':  page,
        'pages': max(1, -(-total // limit)),
        'items': [{
            'id':             u.id,
            'username':       u.username,
            'email':          u.email,
            'is_admin':       u.is_admin,
            'created_at':     u.created_at.isoformat(),
            'nb_predictions': PredictionHistory.query.filter_by(user_id=u.id).count()
        } for u in users]
    }), 200

@app.route('/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def admin_delete_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'error': 'Utilisateur introuvable'}), 404
    if user.is_admin:
        return jsonify({'error': 'Impossible de supprimer un administrateur'}), 403
    PredictionHistory.query.filter_by(user_id=user_id).delete()
    db.session.delete(user)
    db.session.commit()
    logger.info(f"Utilisateur supprimé par admin : {user.username} (id={user_id})")
    return jsonify({'message': f'Utilisateur {user.username} supprimé'}), 200

# ============================================================
# DÉMARRAGE
# ============================================================
if __name__ == '__main__':
    with app.app_context():
        db.create_all()

        # ── Migration : ajouter colonnes marque/modele si manquantes ──
        import sqlite3 as _sq
        _db_path = os.path.join(app.instance_path, 'app.db')
        _conn = _sq.connect(_db_path)
        _cur = _conn.cursor()
        _cur.execute("PRAGMA table_info(prediction_history)")
        _existing = {row[1] for row in _cur.fetchall()}
        if 'marque' not in _existing:
            _cur.execute("ALTER TABLE prediction_history ADD COLUMN marque VARCHAR(100) DEFAULT ''")
            logger.info("🔄 Colonne 'marque' ajoutée à prediction_history")
        if 'modele' not in _existing:
            _cur.execute("ALTER TABLE prediction_history ADD COLUMN modele VARCHAR(100) DEFAULT ''")
            logger.info("🔄 Colonne 'modele' ajoutée à prediction_history")
        _conn.commit()
        _conn.close()

        # ── Seed admin : créer un admin par défaut s'il n'existe pas ──
        admin = User.query.filter_by(is_admin=True).first()
        if not admin:
            default_admin = User(
                username='admin',
                email='admin@autoestimate.ma',
                password_hash=bcrypt.generate_password_hash('admin123').decode('utf-8'),
                is_admin=True
            )
            db.session.add(default_admin)
            db.session.commit()
            logger.info("👤 Admin par défaut créé : admin@autoestimate.ma / admin123")
        else:
            logger.info(f"👤 Admin existant : {admin.email}")

        logger.info("✅ Base de données initialisée")
        logger.info(f"✅ Modèle chargé : {type(model).__name__}")
        logger.info(f"✅ Features      : {len(features)} colonnes")
        logger.info(f"✅ Équipements   : {len(EQUIPEMENTS_COLS)} colonnes")
        logger.info(f"✅ Marques       : {len(MODEL_TO_BRAND)} mappings modèle→marque")
        logger.info("🚀 API AutoEstimate v3 démarrée sur http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
