import urllib.request
import urllib.parse
import json
import time
import sys

base_url = "http://127.0.0.1:8004"

time.sleep(2) # Give server time to start

try:
    # 1. Register
    print("Testing /register...")
    req = urllib.request.Request(
        f"{base_url}/register",
        data=json.dumps({"name": "Test User", "email": "test@test.com", "password": "password123"}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as response:
            print("Register response:", response.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 400:
            print("User already registered. Continuing to login...")
        else:
            raise
    
    # 2. Login
    print("\nTesting /login...")
    req = urllib.request.Request(
        f"{base_url}/login",
        data=json.dumps({"email": "test@test.com", "password": "password123"}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print("Login response received. Checking token...")
        token = data.get("access_token")
        if token:
            print("Token acquired successfully.")
        else:
            print("Failed to acquire token.", data)
            sys.exit(1)

    # 3. Get /users/me
    print("\nTesting protected route /users/me...")
    req = urllib.request.Request(
        f"{base_url}/users/me",
        headers={'Authorization': f'Bearer {token}'}
    )
    with urllib.request.urlopen(req) as response:
        print("Me response:", response.read().decode())

except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code} - {e.read().decode()}")
except Exception as e:
    print(f"Error: {e}")
