const DataStorage = (function() {

  const SDCARDS = navigator.getDeviceStorages('sdcard');

  function getStorageNameByPath(path) {
    var split = path.split('/')
    if (split[0] !== '' && split[0].length > 0) {
      return ''; // emulator
    } else {
      return split[1]; // realdevice
    }
  }

  function getSDCard(name) {
    var card;
    for (var x in SDCARDS) {
      if (SDCARDS[x].storageName === name) {
        card = SDCARDS[x];
        break;
      }
    }
    return card;
  }

  function enumerate(cards, index, files, cb) {
    const cursor = cards[index].enumerate('');
    cursor.onsuccess = function () {
      if (!this.done) {
        if(cursor.result.name !== null) {
          files.push(cursor.result);
          this.continue();
        }
      } else {
        if (cards.length === (index + 1)) {
          cb(files);
        } else {
          enumerate(SDCARDS, (index + 1), files, cb);
        }
      }
    }
    cursor.onerror = (err) => {
      console.warn(`No file found: ${err.toString()}`);
      if (cards.length === (index + 1)) {
        cb(files);
      } else {
        enumerate(SDCARDS, (index + 1), files, cb);
      }
    }
  }

  function getAllFiles(cb = function(x){}) {
    var files = [];
    enumerate(SDCARDS, 0, files, cb);
  }

  const SDCARD = navigator.getDeviceStorage('sdcard');

  function DataStorage(onChange, onReady) {
    this.init(onChange, onReady);
  }

  DataStorage.prototype.init = function(onChange = () => {}, onReady = () => {}) {
    this.trailingSlash = '';
    this.isReady = false;
    this.onChange = onChange;
    this.onReady = onReady;
    this.fileRegistry = [];
    this.fileAttributeRegistry = {};
    this.documentTree = {};
    this.groups = {};
    this.indexingStorage();
    this._internalChangeListener = (event) => {
      this.indexingStorage();
    }
    SDCARDS.forEach((c) => {
      c.addEventListener("change", this._internalChangeListener);
    });
  }

  DataStorage.prototype.destroy = function() {
    SDCARDS.forEach((c) => {
      c.removeEventListener("change", this._internalChangeListener);
    });
  }

  DataStorage.prototype.indexingStorage = function() {
    var _this = this;
    var files = [];
    _this.isReady = false;
    if (typeof _this.onReady === "function" ) {
      _this.onReady(false);
    }
    getAllFiles((_files) => {
      _files.forEach((f) => {
        files.push(f.name);
        _this.fileAttributeRegistry[f.name] = { type: f.type, size: f.size, lastModified: f.lastModified };
      });
      _this.fileRegistry = files;
      _this.documentTree = indexingDocuments(files, _this);
      groupByType(files, function(grouped) {
        _this.groups = grouped;
          if (_this.onChange != undefined) {
          _this.onChange(_this.fileRegistry, _this.documentTree, _this.groups);
        }
        _this.isReady = true;
        if (typeof _this.onReady === "function" ) {
          _this.onReady(true);
        }
        if (typeof _this.onReady === "function" ) {
          _this.onReady(true);
        }
      });
    });
  }

  DataStorage.prototype.getFile = function(name, success, error, getEditable) {
    getFile(this.trailingSlash + name, success, error, getEditable);
  }

  DataStorage.prototype.addFile = function(path, name, blob) {
    var _this = this;
    var des = this.trailingSlash + [...path, name].join('/');

    function addFile(success, fail) {
      var request = getSDCard(getStorageNameByPath(des)).addNamed(blob, des);
      request.onsuccess = function (evt) {
        var find = getSDCard(getStorageNameByPath(evt.target.result)).get(evt.target.result);
        find.onsuccess = function (evt2) {
          success(evt2.target.result);
        }
        find.onerror = function (err) {
          fail(err);
        }
      }
      request.onerror = function (err) {
        fail(err);
      }
    }

    return new Promise((success, fail) => {
      var remove = getSDCard(getStorageNameByPath(des)).delete(des);
      remove.onsuccess = function () {
        addFile(success, fail);
      }
      remove.onerror = function () {
        addFile(success, fail);
      }
    });
  }

  DataStorage.prototype.copyFile = function(path, name, to, isCut) {
    var _this = this;
    return new Promise((success, fail) => {
      this.getFile([...path, name].join('/'), function(res) {
        var des = _this.trailingSlash + to + "/" + name;
        if (to.length == 0 || to === '') {
          des = _this.trailingSlash + name;
        }
        var request = getSDCard(getStorageNameByPath(des)).addNamed(res, des);
        request.onsuccess = function (result) {
          success(result);
          if (isCut === true) {
            _this.deleteFile(JSON.parse(JSON.stringify(path)), name);
          }
        }
        request.onerror = function (err) {
          fail(err);
        }
      }, function(err) {
        fail(err);
      });
    });
  }

  DataStorage.prototype.deleteFile = function(path, name) {
    var _this = this;
    return new Promise((success, fail) => {
      path.push(name)
      var dir = JSON.parse(JSON.stringify(_this.documentTree));
      var valid = false;
      for (var i in path) {
        if (typeof dir[path[i]] === 'string') {
          valid = true;
        } else if (typeof dir[path[i]] === 'object') {
          dir = JSON.parse(JSON.stringify(dir[path[i]]));
        }
      };
      if (!valid) {
        fail("NoModificationAllowedError");
        return
      }
      const des = _this.trailingSlash + path.join('/');
      var request = getSDCard(getStorageNameByPath(des)).delete(des);
      request.onsuccess = function(res) {
        success(res);
      }
      request.onerror = function(err) {
        fail(err);
      }
    });
  }

  DataStorage.prototype.newFolder = function(path, name) {
    var _this = this;
    return new Promise((success, fail) => {
      var file = new Blob(["index"], {type: "text/plain"});
      path.push(name)
      var dir = JSON.parse(JSON.stringify(_this.documentTree));
      var valid = false;
      for (var i in path) {
        if (dir[path[i]] == null) {
          valid = true;
        } else if (typeof dir[path[i]] === 'object') {
          dir = JSON.parse(JSON.stringify(dir[path[i]]));
        }
      };
      if (!valid) {
        fail("NoModificationAllowedError");
        return
      }
      path.push(".index")
      const des = _this.trailingSlash + path.join('/');
      var request = getSDCard(getStorageNameByPath(des));
      if (request == null) {
        fail("Unable to create folder on root path");
      } else {
        const req = request.addNamed(file, des);
        req.onsuccess = function(res) {
          success(res);
        }
        req.onerror = function(err) {
          fail(err);
        }
      }
    });
  }

  DataStorage.prototype.copyFolder = function(path, name, to, doneCb, progressCb, isCut) {
    var _this = this;
    var files = [];
    var taskSuccess = 0;
    var taskFail = 0;
    var resume = false;
    var origin = JSON.parse(JSON.stringify(path));
    var tempPath = JSON.parse(JSON.stringify(path));
    tempPath.push(name);
    var dir = JSON.parse(JSON.stringify(_this.documentTree));
    for (var i in tempPath) {
      if (typeof dir[tempPath[i]] === 'object') {
        dir = JSON.parse(JSON.stringify(dir[tempPath[i]]));
        resume = true;
      }
    };
    if (!resume) {
      if (typeof doneCb === 'function') {
        doneCb(taskSuccess, taskFail, files.length);
      }
      return;
    }
    function getFiles(dir) {
      if (typeof dir === 'object') {
        for (var x in dir) {
          getFiles(dir[x]);
        }
      } else {
        files.push(dir);
      }
    }
    getFiles(dir);
    files.forEach((filePath) => {
      var pathName = filePath.replace(origin.join('/'), '');
      if (pathName[0] === '/') {
        pathName = pathName.replace('/', '');
      }
      this.getFile(this.trailingSlash + filePath, function(res) {
        var des = _this.trailingSlash + to + "/" + pathName;
        if (to.length == 0 || to === '') {
          des = _this.trailingSlash + pathName;
        }
        var request = getSDCard(getStorageNameByPath(des)).addNamed(res, des);
        request.onsuccess = function (result) {
          taskSuccess += 1;
          if (typeof progressCb === 'function') {
            progressCb(taskSuccess, taskFail, files.length);
          }
          if (taskSuccess + taskFail === files.length && typeof doneCb === 'function') {
            doneCb(taskSuccess, taskFail, files.length);
            if (isCut === true) {
              _this.deleteFolder(path, name);
            }
          }
        }
        request.onerror = function (err) {
          taskFail += 1;
          if (typeof progressCb === 'function') {
            progressCb(taskSuccess, taskFail, files.length);
          }
          if (taskSuccess + taskFail === files.length && typeof doneCb === 'function') {
            doneCb(taskSuccess, taskFail, files.length);
            if (isCut === true) {
              _this.deleteFolder(path, name);
            }
          }
        }
      }, function(err) {
        taskFail += 1;
        if (typeof progressCb === 'function') {
          progressCb(taskSuccess, taskFail, files.length);
        }
        if (taskSuccess + taskFail === files.length && typeof doneCb === 'function') {
          doneCb(taskSuccess, taskFail, files.length);
        }
      });
    });
  }

  DataStorage.prototype.deleteFolder = function(path, name, doneCb, progressCb) {
    var _this = this;
    var files = [];
    var taskSuccess = 0;
    var taskFail = 0;
    var resume = false;
    path.push(name);
    var dir = JSON.parse(JSON.stringify(_this.documentTree));
    for (var i in path) {
      if (typeof dir[path[i]] === 'object') {
        dir = JSON.parse(JSON.stringify(dir[path[i]]));
        resume = true;
      } else if (typeof dir[path[i]] === 'undefined') {
        resume = false;
      }
    };
    if (!resume) {
      if (typeof doneCb === 'function') {
        doneCb(taskSuccess, taskFail, files.length);
      }
      return;
    }
    function getFiles(dir) {
      if (typeof dir === 'object') {
        for (var x in dir) {
          getFiles(dir[x]);
        }
      } else {
        files.push(dir);
      }
    }
    getFiles(dir);
    files.forEach((filePath) => {
      const des = _this.trailingSlash + filePath;
      var request = getSDCard(getStorageNameByPath(des)).delete(des);
      request.onsuccess = function(res) {
        taskSuccess += 1;
        if (typeof progressCb === 'function') {
          progressCb(taskSuccess, taskFail, files.length);
        }
        if (taskSuccess + taskFail === files.length && typeof doneCb === 'function') {
          doneCb(taskSuccess, taskFail, files.length);
        }
      }
      request.onerror = function(err) {
        taskFail += 1;
        if (typeof progressCb === 'function') {
          progressCb(taskSuccess, taskFail, files.length);
        }
        if (taskSuccess + taskFail === files.length && typeof doneCb === 'function') {
          doneCb(taskSuccess, taskFail, files.length);
        }
      }
    });
  }

  function getFile(name, success, error, getEditable) {
    var request;
    if (getEditable === true) {
      request = getSDCard(getStorageNameByPath(name)).getEditable(name);
    } else {
      request = getSDCard(getStorageNameByPath(name)).get(name);
    }
    request.onsuccess = function () {
      if (success !== undefined) {
        success(this.result);
      }
    }
    request.onerror = function () {
      if (error !== undefined) {
        error(this.error);
      }
    }
  }

  function getChild(segments, tree, parent, root) {
    if (segments.length === 1) {
      tree[parent] = root
      return tree;
    } else {
      if (tree[parent] === undefined) {
        tree[parent] = {}
      }
      tree[parent] = getChild(segments.slice(1, segments.length), tree[parent], segments.slice(1, segments.length)[0], root)
      return tree;
    }
  }

  function indexingDocuments(files, _this) {
    var docTree = {}
    files.forEach(function(element) {
      if (element[0] === '/') {
        element = element.replace('/', '');
        _this.trailingSlash = '/';
      }
      var folder = element.split('/')[0] === '' ? 'root' : element.split('/')[0];
      docTree = getChild(element.split('/'), docTree, folder, element);
    })
    return docTree;
  }

  function groupByType(files, cb = ()=>{}) {
    var _taskLength = files.length;
    var _taskFinish = 0;
    var _groups = {};
    files.forEach(function(element) {
      getFile(element, function(file) {
        var type = 'unknown'
        if (file.type === '') {
          var mime = file.name.split('.');
          if (mime.length > 1 && mime[mime.length - 1] !== '') {
            type = mime[mime.length - 1]
          }
          if (_groups[type] == undefined) {
            _groups[type] = []
          }
        } else {
          var mime = file.type.split('/');
          type = mime[0]
          if (_groups[type] == undefined) {
            _groups[type] = []
          }
        }
        _groups[type].push(file.name);
        _taskFinish++;
        if (_taskFinish === _taskLength) {
          cb(_groups);
        }
      });
    })
    return _groups;
  }

  DataStorage.prototype.__getFile__ = getFile;

  return DataStorage;
})();
