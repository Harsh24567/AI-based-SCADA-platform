import socket
import concurrent.futures

def check_port(ip, port=502, timeout=0.1):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            s.connect((ip, port))
            return True
    except:
        return False

def scan_network():
    ips_to_scan = []
    
    common = ["192.168.0.3", "192.168.1.3", "192.168.0.10", "192.168.1.10", "192.168.0.254", "192.168.1.254"]
    ips_to_scan.extend(common)
    
    for i in range(1, 255):
        ips_to_scan.append(f"192.168.0.{i}")
        ips_to_scan.append(f"192.168.1.{i}")
        
    print(f"Scanning {len(ips_to_scan)} IP addresses for open Modbus port (502)...")
    
    found = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        future_to_ip = {executor.submit(check_port, ip): ip for ip in ips_to_scan}
        for future in concurrent.futures.as_completed(future_to_ip):
            ip = future_to_ip[future]
            try:
                is_open = future.result()
                if is_open:
                    print(f"[+] FOUND Modbus Device at: {ip}:502")
                    found.append(ip)
            except Exception as exc:
                pass
                
    if not found:
        print("[-] No Modbus devices found responding on port 502.")

if __name__ == '__main__':
    scan_network()
