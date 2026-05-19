import urllib.request
import json

BASE_URL = "http://127.0.0.1:5000"

try:
    print("Testing /api/fraud-detector/metrics...")
    with urllib.request.urlopen(f"{BASE_URL}/api/fraud-detector/metrics") as response:
        status = response.getcode()
        body = response.read().decode('utf-8')
        print(f"Status: {status}")
        print(json.dumps(json.loads(body), ensure_ascii=True))
    
    print("\nTesting /api/fraud-detector/predict...")
    payload = {
        "amount": 2500000.0,
        "hour": 3,
        "is_weekend": 1,
        "payment_method": "Ví điện tử",
        "merchant_category": "Ăn uống",
        "location": "Hà Nội"
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/fraud-detector/predict",
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as response:
        status = response.getcode()
        body = response.read().decode('utf-8')
        print(f"Status: {status}")
        print(json.dumps(json.loads(body), ensure_ascii=True))
    
except Exception as e:
    print(f"Connection failed: {e}")
