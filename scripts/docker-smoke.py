"""Test the built image with a disposable volume; never uses production data."""
import subprocess
import uuid
import time
import json
import urllib.request
import urllib.error

label = 'hkit-smoke-' + uuid.uuid4().hex[:8]
volume = label + '-data'

def run(*args):
    return subprocess.check_output(['docker', *args], text=True).strip()

def request(base, path, method='GET', data=None, cookie=None):
    headers = {}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    if cookie:
        headers['Cookie'] = cookie
    req = urllib.request.Request(base + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=3) as response:
        return json.load(response), response.headers.get('Set-Cookie')

def ready():
    base = 'http://' + run('port', label, '3000/tcp').splitlines()[0]
    for attempt in range(50):
        try:
            response, _ = request(base, '/api/health')
            assert response['status'] == 'ok'
            return base
        except (OSError, urllib.error.URLError):
            time.sleep(.2)
    raise RuntimeError('Container did not become ready: ' + run('logs', label))

try:
    run('run', '-d', '--name', label, '--mount',
        f'type=volume,src={volume},dst=/var/lib/heritage',
        '-p', '127.0.0.1::3000', '-e',
        'ADMIN_PASSWORD=container-test-password-long', 'hcmus-heritagekit:0.2')
    base = ready()
    _, cookie = request(base, '/api/login', 'POST', {
        'email': 'admin@heritagekit.local', 'password': 'container-test-password-long'})
    cookie = cookie.split(';')[0]
    record, _ = request(base, '/api/heritage', 'POST', {
        'title': 'Container persistence test', 'category': 'Di tích lịch sử',
        'location': 'Test only', 'media': [], 'timeline': []}, cookie)
    assert record['id']
    file, _ = request(base, '/api/uploads', 'POST', {
        'name': 'test.pdf', 'base64': 'JVBERi0xLjQKdGVzdAolJUVPRg=='}, cookie)
    assert file['url'].startswith('/uploads/')
    run('stop', label)
    run('start', label)
    base = ready()
    _, cookie = request(base, '/api/login', 'POST', {
        'email': 'admin@heritagekit.local', 'password': 'container-test-password-long'})
    cookie = cookie.split(';')[0]
    records, _ = request(base, '/api/heritage', cookie=cookie)
    assert len(records) == 1
    req = urllib.request.Request(base + file['url'], headers={'Cookie': cookie})
    with urllib.request.urlopen(req, timeout=3) as response:
        assert response.read().startswith(b'%PDF-')
    run('exec', label, 'su', '-s', '/bin/sh', 'node', '-c',
        'node /app/scripts/snapshot.mjs backup /var/lib/heritage/backups/smoke')
    for path in ['/', '/toolkit.js', '/guides/thuyet-minh-thuc-hien.pdf']:
        with urllib.request.urlopen(base + path, timeout=3) as response:
            assert response.status == 200
    print('Docker PASS: health, login, record/upload, restart persistence, snapshot and public assets.')
finally:
    subprocess.run(['docker', 'rm', '-f', label], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    subprocess.run(['docker', 'volume', 'rm', volume], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
