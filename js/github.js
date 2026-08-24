// GitHub Contents API 客户端与发布流程。

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(function (b) { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function buildPutPayload(filePath, base64, sha, message, branch) {
  const body = { message: message, content: base64, branch: branch || 'main' };
  if (sha) body.sha = sha;
  return body;
}

class GitHubClient {
  constructor(opts) {
    this.token = opts.token;
    this.owner = opts.owner;
    this.repo = opts.repo;
    this.branch = opts.branch || 'main';
  }

  _headers() {
    return {
      'Authorization': 'Bearer ' + this.token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  async _request(method, path, body) {
    const res = await fetch('https://api.github.com' + path, {
      method: method,
      headers: this._headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error('GitHub API ' + res.status + ': ' + text.slice(0, 200));
    }
    return res.json();
  }

  async getFile(filePath) {
    const path = '/repos/' + this.owner + '/' + this.repo + '/contents/' + filePath + '?ref=' + this.branch;
    const res = await fetch('https://api.github.com' + path, { headers: this._headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('GitHub get ' + res.status);
    const json = await res.json();
    return { sha: json.sha, content: json.content };
  }

  async putFile(filePath, base64, sha, message) {
    return this._request('PUT', '/repos/' + this.owner + '/' + this.repo + '/contents/' + filePath,
      buildPutPayload(filePath, base64, sha, message, this.branch));
  }

  async deleteFile(filePath, sha, message) {
    return this._request('DELETE', '/repos/' + this.owner + '/' + this.repo + '/contents/' + filePath,
      { message: message, branch: this.branch, sha: sha });
  }

  async publish(opts) {
    const msg = 'Update content via editor';
    const addImages = opts.addImages || [];
    const removeImages = opts.removeImages || [];

    // 1. 先上传新增图片（此时 data.json 未变，访客仍见旧内容）
    for (const img of addImages) {
      await this.putFile(img.path, img.base64, null, msg);
    }
    // 2. 删除已移除图片
    for (const path of removeImages) {
      const existing = await this.getFile(path);
      if (existing) await this.deleteFile(path, existing.sha, msg);
    }
    // 3. 最后更新 data.json（所有图片已就位，指向正确）
    const cur = await this.getFile('data.json');
    await this.putFile('data.json', utf8ToBase64(opts.dataJson), cur ? cur.sha : undefined, msg);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GitHubClient: GitHubClient, utf8ToBase64: utf8ToBase64, buildPutPayload: buildPutPayload };
}
