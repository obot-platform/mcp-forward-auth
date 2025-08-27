#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_OWNER = 'obot-platform';
const REPO_NAME = 'mcp-oauth-proxy';

function getPlatform() {
  const platform = process.platform;
  switch (platform) {
    case 'darwin':
      return 'darwin';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function getArch() {
  const arch = process.arch;
  switch (arch) {
    case 'x64':
      return 'amd64';
    case 'arm64':
      return 'arm64';
    default:
      throw new Error(`Unsupported architecture: ${arch}`);
  }
}

function getBinaryName() {
  const platform = getPlatform();
  const arch = getArch();
  return `mcp-oauth-proxy-${platform}-${arch}${platform === 'windows' ? '.exe' : ''}`;
}

function getPackageConfig() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  return packageJson.config?.mcpOauthProxyVersion || 'latest';
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, dest)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function getLatestRelease() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
      headers: {
        'User-Agent': 'mcp-forward-auth-installer'
      }
    };

    https.get(options, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const release = JSON.parse(data);
          resolve(release);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    console.log('Installing mcp-oauth-proxy binary...');
    
    const version = getPackageConfig();
    const binaryName = getBinaryName();
    
    let downloadUrl;
    
    if (version === 'latest') {
      console.log('Fetching latest release...');
      const release = await getLatestRelease();
      const asset = release.assets.find(asset => asset.name === binaryName);
      
      if (!asset) {
        throw new Error(`Binary not found for platform: ${binaryName}`);
      }
      
      downloadUrl = asset.browser_download_url;
      console.log(`Found version ${release.tag_name}`);
    } else {
      downloadUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${version}/${binaryName}`;
    }
    
    const binDir = path.join(__dirname, '..', 'bin');
    const binaryPath = path.join(binDir, 'mcp-oauth-proxy');
    
    // Create bin directory if it doesn't exist
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }
    
    console.log(`Downloading ${downloadUrl}...`);
    await downloadFile(downloadUrl, binaryPath);
    
    // Make binary executable (Unix-like systems)
    if (process.platform !== 'win32') {
      fs.chmodSync(binaryPath, 0o755);
    }
    
    console.log('mcp-oauth-proxy binary installed successfully!');
    
  } catch (error) {
    console.error('Failed to install mcp-oauth-proxy binary:', error.message);
    console.error('The package will still work, but you need to provide the binary manually.');
    // Don't exit with error to allow package installation to continue
  }
}

main();