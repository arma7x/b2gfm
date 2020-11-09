const DataStorage = (function() {

  const SDCARD = navigator.getDeviceStorage('sdcard');

  function DataStorage(onChange) {
    this.init(onChange);
  }

  DataStorage.prototype.init = function(onChange) {
    this.trailingSlash = '';
    this.onChange = onChange;
    this.fileRegistry = [];
    this.documentTree = {}
    this.groups = {}
    this.indexingStorage();
    SDCARD.addEventListener("change", (event) => {
      this.indexingStorage();
    });
  }

  DataStorage.prototype.indexingStorage = function() {
    var _this = this;
    var files = [];
    const cursor = SDCARD.enumerate('');
    cursor.onsuccess = function() {
      if (!this.done) {
        if(cursor.result.name !== null) {
          files.push(cursor.result.name)
          this.continue();
        }
      } else {
        _this.fileRegistry = files;
        _this.documentTree = indexingDocuments(files, _this);
        _this.groups = groupByType(files);
        if (_this.onChange != undefined) {
          _this.onChange(_this.fileRegistry, _this.documentTree, _this.groups);
        }
      }
    }
    cursor.onerror = function () { 
      console.warn("No file found: " + this.error); 
    }
  }

  DataStorage.prototype.getFile = function(name, success, error) {
    getFile(this.trailingSlash + name, success, error);
  }

  DataStorage.prototype.copyFile = function(path, name, to, isCut) {
    var _this = this;
    return new Promise((success, fail) => {
      this.getFile(this.trailingSlash + [...path, name].join('/'), function(res) {
        var des = _this.trailingSlash + to + "/" + name;
        if (to.length == 0 || to === '') {
          des = _this.trailingSlash + name;
        }
        console.log(des);
        var request = SDCARD.addNamed(res, des);
        request.onsuccess = function (result) {
          success(result);
          if (isCut === true) {
            _this.deleteFile(path, name);
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
        fail({ name: "NoModificationAllowedError", message: "" });
        return
      }
      var request = SDCARD.delete(_this.trailingSlash + path.join('/'));
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
        fail({ name: "NoModificationAllowedError", message: "" });
        return
      }
      path.push(".index")
      var request = SDCARD.addNamed(file, _this.trailingSlash + path.join('/'));
      request.onsuccess = function(res) {
        success(res);
      }
      request.onerror = function(err) {
        fail(err);
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
      this.getFile(this.trailingSlash + filePath, function(res) {
        var des = _this.trailingSlash + to + "/" + name;
        if (to.length == 0 || to === '') {
          des = _this.trailingSlash + name;
        }
        var request = SDCARD.addNamed(res, des);
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
      var request = SDCARD.delete(_this.trailingSlash + filePath);
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

  function getFile(name, success, error) {
    var request = SDCARD.get(name);
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
        _this.trailingSlash = '/'
        var elementArray = element.split('/');
        _this.trailingSlash += elementArray.shift() + '/';
        element = elementArray.join('/');
      }
      var folder = element.split('/')[0] === '' ? 'root' : element.split('/')[0];
      docTree = getChild(element.split('/'), docTree, folder, element);
    })
    return docTree;
  }

  function groupByType(files) {
    var _taskLength = files.length;
    var _taskFinish = 0;
    var _groups = {};
    files.forEach(function(element) {
      getFile(element, function(file) {
        var type = 'Unknown'
        if (file.type === '') {
          var mime = file.name.split('.');
          if (mime[mime.length - 1] !== '') {
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
      });
    })
    return _groups;
  }

  return DataStorage;
})();