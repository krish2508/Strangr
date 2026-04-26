import urllib.request
import urllib.parse
import json
import time
import sys
import http.cookiejar

base_url = "http://127.0.0.1:8004/api"
cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

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
        with opener.open(req) as response:
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
    with opener.open(req) as response:
        data = json.loads(response.read().decode())
        print("Login response received. Checking user payload and cookies...")
        user = data.get("user")
        access_cookie = next((cookie for cookie in cookie_jar if cookie.name == "strangr_access_token"), None)
        refresh_cookie = next((cookie for cookie in cookie_jar if cookie.name == "strangr_refresh_token"), None)
        if user and access_cookie and refresh_cookie:
            print("Session acquired successfully.")
        else:
            print("Failed to acquire session.", data)
            sys.exit(1)

    # 3. Get /users/me
    print("\nTesting protected route /users/me...")
    req = urllib.request.Request(
        f"{base_url}/users/me"
    )
    with opener.open(req) as response:
        print("Me response:", response.read().decode())

except urllib.error.HTTPError as e:
    print(f"HTTPError: {e.code} - {e.read().decode()}")
except Exception as e:
    print(f"Error: {e}")
