import os
import sys
import json
import subprocess
import urllib.request
import urllib.error
from base64 import b64encode
from nacl import encoding, public

GITHUB_REPO = "mohanedkahled84-create/tutoring-saas"

def get_github_token():
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        return token
    try:
        # Retrieve token dynamically from local git credential manager
        p = subprocess.run(
            ["git", "credential", "fill"],
            input="protocol=https\nhost=github.com\n",
            capture_output=True,
            text=True,
            check=True
        )
        for line in p.stdout.splitlines():
            if line.startswith("password="):
                return line.split("=", 1)[1].strip()
    except Exception as e:
        pass
    return None

def get_repo_public_key(token):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/actions/secrets/public-key"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Centrly-CLI"
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def encrypt_secret(public_key_b64: str, secret_value: str) -> str:
    public_key = public.PublicKey(public_key_b64.encode("utf-8"), encoding.Base64Encoder())
    sealed_box = public.SealedBox(public_key)
    encrypted = sealed_box.encrypt(secret_value.strip().encode("utf-8"))
    return b64encode(encrypted).decode("utf-8")

def set_github_secret(token: str, key_id: str, secret_name: str, encrypted_value: str):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/actions/secrets/{secret_name}"
    data = json.dumps({
        "encrypted_value": encrypted_value,
        "key_id": key_id
    }).encode("utf-8")
    
    req = urllib.request.Request(url, data=data, method="PUT", headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Centrly-CLI"
    })
    with urllib.request.urlopen(req) as resp:
        return resp.status in (201, 204)

def main():
    print("=" * 60)
    print("🔒 Centrly GitHub Secrets & Supabase Test DB Provisioner")
    print("=" * 60)
    
    token = get_github_token()
    if not token:
        print("❌ Error: Could not resolve GitHub token from environment or Git credentials.")
        print("Please set GITHUB_TOKEN environment variable.")
        sys.exit(1)
        
    test_url = input("1. Enter SUPABASE_TEST_URL (e.g. https://xxx.supabase.co): ").strip()
    test_anon = input("2. Enter SUPABASE_TEST_ANON_KEY: ").strip()
    test_service = input("3. Enter SUPABASE_TEST_SERVICE_ROLE_KEY: ").strip()
    
    if not test_url or not test_anon or not test_service:
        print("❌ Error: All 3 Supabase keys are required.")
        sys.exit(1)
        
    print("\n📡 Fetching GitHub repository public encryption key...")
    pk_data = get_repo_public_key(token)
    key_id = pk_data["key_id"]
    public_key = pk_data["key"]
    print(f"✅ Retrieved public key (ID: {key_id})")
    
    secrets_to_set = {
        "SUPABASE_TEST_URL": test_url,
        "SUPABASE_TEST_ANON_KEY": test_anon,
        "SUPABASE_TEST_SERVICE_ROLE_KEY": test_service,
    }
    
    print("\n🔐 Encrypting and uploading secrets to GitHub...")
    for name, val in secrets_to_set.items():
        enc_val = encrypt_secret(public_key, val)
        ok = set_github_secret(token, key_id, name, enc_val)
        if ok:
            print(f"   ✅ Secret [{name}] successfully set in GitHub Actions.")
        else:
            print(f"   ❌ Failed to set [{name}].")

    print("\n🎉 All test secrets successfully configured in GitHub repository secrets!")
    print("🚀 Codex and GitHub Actions CI can now run live security tests against this test instance.")

if __name__ == "__main__":
    main()
