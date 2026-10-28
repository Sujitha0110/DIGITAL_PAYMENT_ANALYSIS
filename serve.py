import sys
import os
import json
import math
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class ProductionPaymentServerHandler(SimpleHTTPRequestHandler):
    # Explicit MIME mappings to ensure strict browsers load all assets correctly in Linux containers
    extensions_map = SimpleHTTPRequestHandler.extensions_map.copy()
    extensions_map.update({
        '': 'application/octet-stream',
        '.html': 'text/html; charset=utf-8',
        '.htm': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.mjs': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.csv': 'text/csv; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.ico': 'image/x-icon',
        '.txt': 'text/plain; charset=utf-8',
        '.sql': 'text/plain; charset=utf-8'
    })

    def end_headers(self):
        # Enable CORS and optimize caching for live dashboard updates
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        if self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Pragma', 'no-cache')
            self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def send_json(self, status_code, payload):
        data = json.dumps(payload, indent=2).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        # Normalize path
        req_path = self.path.split('?')[0]

        # API Health Endpoint (/api/health or /health)
        if req_path in ('/api/health', '/health'):
            payload = {
                "status": "healthy",
                "service": "Digital Payment Analysis & ML Prediction Service",
                "version": "2.2.0",
                "runtime": "Python 3 (ThreadingHTTPServer)",
                "port": int(os.environ.get('PORT', 8080)),
                "dataset_records": 5000,
                "ml_model": "Logistic Regression (Balanced, C=1.0)",
                "database_schema": "digital_payment_db (MySQL/MariaDB)",
                "power_bi_architecture": "Star Schema Model (Part 4-6 Analytics Views)",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            return self.send_json(200, payload)

        # API Power BI Metadata Endpoint (/api/powerbi or /powerbi)
        if req_path in ('/api/powerbi', '/powerbi'):
            pbi_payload = {
                "schema_type": "Star Schema",
                "fact_table": "Fact_Transactions (5,000 rows)",
                "dimension_tables": [
                    "Dim_Gateway (Razorpay, Cashfree, PayU)",
                    "Dim_PaymentMethod (GPay/UPI, Credit Card, Debit Card, NetBanking, Wallet)",
                    "Dim_Date (Calendar hierarchy: Month, Week, Day, Hour)",
                    "Dim_Customer (Unique customer IDs, past failure rate)",
                    "Dim_ErrorCodes (Failure taxonomy & technical vs customer attribution)"
                ],
                "dax_measures": [
                    {
                        "name": "Failure Rate %",
                        "formula": "DIVIDE(CALCULATE(COUNTROWS(Fact_Transactions), Fact_Transactions[status] = \"FAILED\"), COUNTROWS(Fact_Transactions), 0)"
                    },
                    {
                        "name": "Gross Attempted Value",
                        "formula": "SUM(Fact_Transactions[amount])"
                    },
                    {
                        "name": "Retry Recovery Volume",
                        "formula": "CALCULATE(SUM(Fact_Transactions[recovered_amount]), Fact_Transactions[is_recovered] = 1)"
                    },
                    {
                        "name": "Pending SLA Breach (>15 min)",
                        "formula": "CALCULATE(COUNTROWS(Fact_Transactions), Fact_Transactions[status] = \"PENDING\" && Fact_Transactions[processing_seconds] > 900)"
                    },
                    {
                        "name": "Net Settlement Gap",
                        "formula": "SUM(vw_settlement_gap[gap_amount])"
                    }
                ]
            }
            return self.send_json(200, pbi_payload)

        # Static files fallback for SPA routing
        # If accessing root or non-file path, serve index.html
        if req_path in ('', '/'):
            self.path = '/index.html'

        return super().do_GET()

    def do_POST(self):
        req_path = self.path.split('?')[0]

        # Live ML Failure Risk Prediction Endpoint
        if req_path in ('/api/predict', '/predict'):
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length).decode('utf-8') if content_length > 0 else '{}'
                data = json.loads(body) if body else {}
            except Exception as e:
                return self.send_json(400, {"error": "Invalid JSON body", "details": str(e)})

            try:
                amt = float(data.get('amount', 18500))
                method = str(data.get('payment_method', 'NetBanking'))
                gateway = str(data.get('gateway_name', 'Razorpay'))
                hour = int(data.get('hour', 19))
                cust_hist = float(data.get('customer_previous_failure_rate', 0.67))
                is_weekend = int(data.get('is_weekend', 1))
            except Exception as e:
                return self.send_json(400, {"error": "Invalid parameter format", "details": str(e)})

            # Calibrated Logistic Regression inference equation (matches notebook parameters)
            z = -0.15
            z += cust_hist * 1.85
            norm_amt = (amt - 10000.0) / 10000.0
            z += norm_amt * 0.22

            if method == 'NetBanking': z += 0.38
            elif method == 'Credit Card': z += 0.25
            elif method == 'Debit Card': z += 0.15
            elif method in ('GPay', 'UPI'): z -= 0.10
            elif method == 'Wallet': z -= 0.05

            if gateway == 'PayU': z += 0.18
            elif gateway == 'Cashfree': z += 0.08
            elif gateway == 'Razorpay': z -= 0.08

            if 18 <= hour <= 21: z += 0.32
            elif hour >= 23 or hour <= 4: z += 0.28

            if is_weekend: z += 0.16

            prob = 1.0 / (1.0 + math.exp(-z))
            prob_pct = round(prob * 100.0, 2)

            risk_level = "High" if prob >= 0.52 else ("Low" if prob < 0.40 else "Medium")
            rec = "Intercept & route via lower-latency gateway" if risk_level == "High" else (
                "Monitor OTP delivery & issuer timeout" if risk_level == "Medium" else "Optimal processing pathway"
            )

            res = {
                "transaction_id": "SIM_" + datetime.now(timezone.utc).strftime("%H%M%S%f")[:10],
                "failure_probability": round(prob, 4),
                "failure_probability_pct": prob_pct,
                "risk_level": risk_level,
                "recommendation": rec,
                "model": "Logistic Regression (Balanced, C=1.0)",
                "features_received": {
                    "amount": amt,
                    "payment_method": method,
                    "gateway_name": gateway,
                    "hour": hour,
                    "customer_previous_failure_rate": cust_hist,
                    "is_weekend": is_weekend
                },
                "status": "success",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            return self.send_json(200, res)

        return self.send_json(404, {"error": f"Endpoint '{req_path}' not found"})

def run():
    port = int(os.environ.get('PORT', 8080))
    # Ensure current working directory is the script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)

    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, ProductionPaymentServerHandler)
    httpd.allow_reuse_address = True
    httpd.daemon_threads = True

    print(f"================================================================")
    print(f"  DIGITAL PAYMENT ANALYSIS & PREDICTION LIVE SERVICE")
    print(f"  Port: {port} | Host: 0.0.0.0 (Production Listening)")
    print(f"  Public Endpoints: /api/health, /api/powerbi, /api/predict")
    print(f"  Root Dir: {script_dir}")
    print(f"================================================================")
    sys.stdout.flush()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer gracefully stopped.")

if __name__ == '__main__':
    run()
