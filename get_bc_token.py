"""Génère un jeton Business Central (client credentials) dans BC_TOKEN_FILE (token.txt par défaut).
python get_bc_token.py          -> une fois
python get_bc_token.py --loop   -> renouvelle 10 min avant expiration (à laisser tourner à côté de run_dev.py)
Sur le VPS, c'est le timer systemd existant qui produit le jeton : ce script ne sert qu'en local."""
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')
TENANT = os.getenv('BC_TENANT_ID', 'ef2c50ef-b9e0-499b-a90d-d7b2399d6ec4')
CLIENT_ID = os.getenv('BC_TOKEN_CLIENT_ID', '')
SECRET = os.getenv('BC_TOKEN_CLIENT_SECRET', '')
OUT = Path(os.getenv('BC_TOKEN_FILE') or ROOT / 'token.txt')


def fetch():
    r = requests.post(f'https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token', data={
        'grant_type': 'client_credentials', 'client_id': CLIENT_ID, 'client_secret': SECRET,
        'scope': 'https://api.businesscentral.dynamics.com/.default'}, timeout=20)
    if r.status_code != 200:
        sys.exit(f'Échec {r.status_code} : {r.text[:300]}')
    j = r.json()
    tmp = OUT.with_suffix('.tmp')
    tmp.write_text(j['access_token'], encoding='utf-8')
    if os.name != 'nt':
        os.chmod(tmp, 0o600)
    tmp.replace(OUT)   # écriture atomique
    ttl = int(j.get('expires_in', 3600))
    print(time.strftime('%H:%M:%S'), f'jeton écrit dans {OUT} (valide {ttl // 60} min)')
    return ttl


if __name__ == '__main__':
    if not CLIENT_ID or not SECRET:
        sys.exit('Renseignez BC_TOKEN_CLIENT_ID et BC_TOKEN_CLIENT_SECRET dans .env')
    ttl = fetch()
    while '--loop' in sys.argv:
        time.sleep(max(300, ttl - 600))
        ttl = fetch()
