const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // セキュリティ対策: ディレクトリトラバーサル防止
    let safeUrl = req.url.split('?')[0];
    let filePath = path.join(__dirname, safeUrl === '/' ? 'index.html' : safeUrl);
    
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('403 Forbidden');
        return;
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<h1>404 Not Found</h1><p>指定されたファイルが見つかりません。</p>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

let currentPort = PORT;
let retryCount = 0;
const MAX_RETRIES = 5;

function startServer(port) {
    if (retryCount >= MAX_RETRIES) {
        console.error(`エラー: ポートのバインドに失敗したため、サーバー起動を停止します。直接 index.html をブラウザで開いて確認できます。`);
        return;
    }
    server.listen(port, '127.0.0.1', () => {
        console.log(`Server running at http://localhost:${port}/`);
    });
}

server.on('error', (e) => {
    if (e.code === 'EADDRINUSE' || e.code === 'EPERM') {
        console.warn(`ポート ${currentPort} は使用中または制限されています。(${e.code})`);
        currentPort++;
        retryCount++;
        setTimeout(() => {
            startServer(currentPort);
        }, 200);
    } else {
        console.error('サーバーエラー:', e);
    }
});

startServer(currentPort);
