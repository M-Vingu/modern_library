function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    download(filePath) {
      this.downloadPath = filePath;
      return this;
    },
  };
}

module.exports = { createMockRes };
