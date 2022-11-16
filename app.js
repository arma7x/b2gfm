window.addEventListener("load", function() {

  const pushLocalNotification = function(text) {
    window.Notification.requestPermission().then(function(result) {
      var notification = new window.Notification(text);
        notification.onclick = function(event) {
          if (window.navigator.mozApps) {
            var request = window.navigator.mozApps.getSelf();
            request.onsuccess = function() {
              if (request.result) {
                notification.close();
                request.result.launch();
              }
            };
          } else {
            window.open(document.location.origin, '_blank');
          }
        }
        notification.onshow = function() {
          notification.close();
        }
    });
  }

  function humanFileSize(bytes, si=false, dp=1) {
    const thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
      return bytes + ' Byte';
    }
    const units = si  ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = Math.pow(10, dp);
    do {
      bytes /= thresh;
      ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);
    return bytes.toFixed(dp) + ' ' + units[u];
  }

  const state = new KaiState({
    'fileRegistry': [],
    'documentTree': {}
  });

  const mainPage = new Kai({
    name: '_main_',
    data: {
      title: '_main_',
      paths: [],
      currentFolderContents: [],
      currentFocus: [0],
      copyPath: '',
      cutPath: '',
      pasteType: '',
      menu: [
        { "text": "Create new folder" },
        { "text": "Add .nomedia" },
        { "text": "Read Me" },
        { "text": "Kill App" }
      ]
    },
    verticalNavClass: '.mainNav',
    components: [],
    templateUrl: document.location.origin + '/templates/main.html',
    mounted: function() {
      this.$router.setHeaderTitle('File Manager');
      this.$state.addGlobalListener(this.methods.listenState);
      this.methods.navigate();
      if (DS.isReady) {
        this.$router.hideLoading();
      } else {
        this.$router.showLoading();
      }
    },
    unmounted: function() {
      this.$state.removeGlobalListener(this.methods.listenState);
    },
    methods: {
      listenState: function(data) {
        this.methods.navigate();
      },
      navigate: function() {
        var documentTree = this.$state.getState('documentTree')
        if (this.data.paths.length > 0) {
          for (var x in this.data.paths) {
            if (documentTree[this.data.paths[x]])
              documentTree = documentTree[this.data.paths[x]]
            else {
              documentTree = {};
              break;
            }
          }
        }
        this.$router.setHeaderTitle('File Manager(' + this.data.paths.length.toString() + ')');
        this.data.currentFolderContents = []
        for (var x in documentTree) {
          var type = 'FILE'
          var isFile = true
          var icon = "unknown.png" // &#128240
          var launcher = null;
          if (typeof documentTree[x] === 'object') {
            type = 'OBJECT'
            isFile = false;
            icon = "folder.png"
          } else {
            const n = DS.trailingSlash + [...this.data.paths, x].join('/')
            const n1 = DS.fileAttributeRegistry[n];
            if (n1) {
              const n2 = n1.type.split('/');
              if (n2[0] === 'text') {
                if (n2[1] === 'plain') {
                  icon = "text.png";
                  launcher = 'text';
                } else if (n2[1] === 'html') {
                  icon = "html.png";
                  launcher = 'text';
                } else if (n2[1] === 'markdown') {
                  icon = "md.png";
                  launcher = 'text';
                }
              } else if (n2[0] === 'audio') {
                icon = "audio.png";
                launcher = 'audio';
              } else if (n2[0] === 'video') {
                icon = "video.png";
                launcher = 'video';
              } else if (n2[0] === 'image') {
                icon = "image.png";
                launcher = 'image';
              } else {
                const n3 = x.split('.');
                if (n3.length > 1) {
                  const ext = n3[n3.length - 1];
                  if (ext === 'md') {
                    icon = "md.png";
                    launcher = 'text';
                  }
                }
              }
            }
          }
          this.data.currentFolderContents.push({text: x, type, icon, isFile, sync: false, launcher: launcher})
        }
        if (this.data.currentFocus[this.data.paths.length] >= this.data.currentFolderContents.length) {
          this.data.currentFocus[this.data.paths.length] = this.data.currentFolderContents.length - 1;
          this.verticalNavIndex = this.data.currentFocus[this.data.paths.length];
        }
        if (this.data.currentFolderContents.length > 0 && this.verticalNavIndex == -1) {
          this.verticalNavIndex = 0;
        }
        this.methods.renderSoftKey();
        this.render()
      },
      selected: function() {
        var _this = this;
        var current = this.data.currentFolderContents[this.verticalNavIndex];
        if (current) {
          if (current.type === 'OBJECT') {
            this.data.paths.push(current.text);
            this.data.currentFocus.push(0);
            this.verticalNavIndex = this.data.currentFocus[this.data.paths.length];
            this.methods.navigate();
          } else if (current.type === 'FILE') {
            if (current.launcher === 'text') {
              DS.getFile([...this.data.paths, current.text].join('/'), (_file) => {
                if (_file.type === 'text/plain') {
                  const _url = URL.createObjectURL(_file);
                  const KAIOS_BROWSER = window.open(_url);
                  var TIMER = setInterval(() => {
                    if (KAIOS_BROWSER.closed) {
                      clearInterval(TIMER);
                      URL.revokeObjectURL(_url);
                    }
                  }, 1000);
                } else if (_file.type === 'text/html') {
                  var reader = new FileReader();
                  reader.onload = (event) => {
                    const HTML = DOMPurify.sanitize(event.target.result, {WHOLE_DOCUMENT: true});
                    const _temp = new Blob([HTML], {type : 'text/html'});
                    const _url = URL.createObjectURL(_temp);
                    const KAIOS_BROWSER = window.open(_url);
                    var TIMER = setInterval(() => {
                      if (KAIOS_BROWSER.closed) {
                        clearInterval(TIMER);
                        URL.revokeObjectURL(_url);
                      }
                    }, 1000);
                  };
                  reader.readAsText(_file);
                } else {
                  const n = current.text.split('.');
                  if (n.length > 1) {
                    const ext = n[n.length - 1];
                    if (ext === 'md') {
                      var reader = new FileReader();
                      reader.onload = (event) => {
                        const HTML = `<!DOCTYPE html><html><head><title>${current.text}</title></head><body>${DOMPurify.sanitize(snarkdown(event.target.result))}</body></html>`;
                        const _temp = new Blob([HTML], {type : 'text/html'});
                        const _url = URL.createObjectURL(_temp);
                        const KAIOS_BROWSER = window.open(_url);
                        var TIMER = setInterval(() => {
                          if (KAIOS_BROWSER.closed) {
                            clearInterval(TIMER);
                            URL.revokeObjectURL(_url);
                          }
                        }, 1000);
                      };
                      reader.readAsText(_file);
                    }
                  }
                }
              }, (e) => {})
            } else if (current.launcher === 'audio' || current.launcher === 'video' || current.launcher === 'image') {
              var type = {
                'audio': 'audio/mpeg',
                'video': 'video/mp4',
                'image': 'image/jpeg',
              };
              DS.getFile([...this.data.paths, current.text].join('/'), (_file) => {
                var _launcher = new MozActivity({
                  name: "open",
                  data: {
                    blob: _file,
                    type: type[current.launcher]
                  }
                });
              }, (_err) => {
                console.log(_err);
              });
            }
          }
        }
      },
      deleteFileOrFolder: function(current) {
        setTimeout(() => {
          this.$router.showDialog('Confirm', 'Are sure to delete ' + current.text + ' ?', this.data, 'Yes', () => {
            if (current.type === 'OBJECT') {
              this.$router.showLoading();
              DS.deleteFolder(JSON.parse(JSON.stringify(this.data.paths)), current.text, (taskSuccess, taskFail, length) => {
                this.$router.hideLoading();
                // console.log(taskSuccess, taskFail, length);
              }, (taskSuccess, taskFail, length) => {
                // console.log(taskSuccess, taskFail, length);
              });
            } else if (current.isFile) {
              DS.deleteFile(JSON.parse(JSON.stringify(this.data.paths)), current.text)
              .then((res) => {
                this.methods.navigate();
              })
              .catch((err) => {
                this.$router.showToast(err.toString())
              });
            }
          }, 'Cancel', undefined, undefined);
        }, 110);
      },
      renderSoftKey: function() {
        var current = this.data.currentFolderContents[this.verticalNavIndex];
        if (current == null) {
          this.$router.setSoftKeyText('Menu', '', '');
        } else if (current.type === 'FILE') {
          if (current.launcher !== null) {
            this.$router.setSoftKeyText('Menu', 'Open', 'Option');
          } else {
            this.$router.setSoftKeyText('Menu', '', 'Option');
          }
        } else if (current.type === 'OBJECT') {
          var txt = this.data.copyPath !== '' || this.data.cutPath !== '' ? 'Option' : '';
          this.$router.setSoftKeyText('Menu', 'OPEN', txt);
        }
      }
    },
    backKeyListener: function() {
      if (this.data.paths.length > 0) {
        this.data.paths.pop();
        this.verticalNavIndex = this.data.currentFocus[this.data.paths.length];
        this.data.currentFocus.pop();
        this.methods.navigate();
        return true;
      }
    },
    softKeyText: { left: 'Menu', center: '', right: 'Option' },
    softKeyListener: {
      left: function() {
        this.$router.showOptionMenu('Menu', this.data.menu, 'Select', (selected) => {
          if (selected.text === 'Create new folder') {
            const folderDialog = Kai.createDialog('Create new folder', '<div><input id="folder-input" placeholder="Enter folder name" class="kui-input" type="text" /></div>', null, '', undefined, '', undefined, '', undefined, undefined, this.$router);
            folderDialog.mounted = () => {
              setTimeout(() => {
                setTimeout(() => {
                  this.$router.setSoftKeyText('Cancel' , '', 'OK');
                  FOLDER_INPUT.focus();
                }, 103);
                const FOLDER_INPUT = document.getElementById('folder-input');
                if (!FOLDER_INPUT) {
                  return;
                }
                FOLDER_INPUT.focus();
                FOLDER_INPUT.addEventListener('keydown', (evt) => {
                  switch (evt.key) {
                    case 'Backspace':
                    case 'EndCall':
                      if (document.activeElement.value.length === 0) {
                        this.$router.hideBottomSheet();
                        setTimeout(() => {
                          this.methods.renderSoftKey();
                          FOLDER_INPUT.blur();
                        }, 100);
                      }
                      break
                    case 'SoftRight':
                      this.$router.hideBottomSheet();
                      setTimeout(() => {
                        this.methods.renderSoftKey();
                        FOLDER_INPUT.blur();
                        if (FOLDER_INPUT.value == '') {
                          pushLocalNotification('Please enter folder name');
                          return
                        }
                        DS.newFolder(JSON.parse(JSON.stringify(this.data.paths)), FOLDER_INPUT.value)
                        .then((res) => {
                          pushLocalNotification(res.target.result);
                        })
                        .catch((err) => {
                          pushLocalNotification(err.toString());
                        });
                      }, 100);
                      break
                    case 'SoftLeft':
                      this.$router.hideBottomSheet();
                      setTimeout(() => {
                        this.methods.renderSoftKey();
                        FOLDER_INPUT.blur();
                      }, 100);
                      break
                  }
                });
              });
            }
            folderDialog.dPadNavListener = {
              arrowUp: function() {
                const FOLDER_INPUT = document.getElementById('folder-input');
                FOLDER_INPUT.focus();
              },
              arrowDown: function() {
                const FOLDER_INPUT = document.getElementById('folder-input');
                FOLDER_INPUT.focus();
              }
            }
            this.$router.showBottomSheet(folderDialog);
            //this.$router.push(newFolderPage(JSON.parse(JSON.stringify(this.data.paths))));
          } else if (selected.text === 'Read Me') {
            this.$router.push('readMe');
          } else if (selected.text === 'Add .nomedia') {
            const blob = new Blob([], {type : 'application/text'});
            DS.addFile(this.data.paths, '.nomedia', blob)
            .then((res) => {
              pushLocalNotification('Done');
            })
            .catch((err) => {
              pushLocalNotification(err.toString());
            });
          } else if (selected.text === 'Kill App') {
            window.close();
          }
        }, () => {
          setTimeout(() => {
            if (this.$router.stack[this.$router.stack.length - 1].name === '_main_') {
              this.methods.renderSoftKey();
            }
          }, 100);
        }, 0);
      },
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {
        var current = this.data.currentFolderContents[this.verticalNavIndex];
        var options = [];
        if (this.data.copyPath !== '' || this.data.cutPath !== '') {
          options.push({ "text": "Paste into current directory"});
          if (current['type'] === 'OBJECT') {
            options.push({ "text": "Paste into this folder"});
          }
        }
        if (current.isFile) {
          options.push({ "text": "Cut"})
          options.push({ "text": "Copy"})
          options.push({ "text": "Delete"});
        }
        if (current.isFile) {
          options.push({ "text": "Properties"})
        }
        if (options.length === 0) {
          return
        }
        this.$router.showOptionMenu('Option', options, 'Select', (selected) => {
          if (selected.text === 'Copy' || selected.text === 'Cut') {
            var temp = JSON.parse(JSON.stringify(this.data.paths))
            temp.push(current.text);
            this.data.pasteType = current['type'];
            if (selected.text === 'Copy') {
              this.data.cutPath = '';
              this.data.copyPath = temp.join('/');
            } else if (selected.text === 'Cut') {
              this.data.cutPath = temp.join('/');
              this.data.copyPath = '';
            }
          } else if (selected.text === 'Delete') {
            this.methods.deleteFileOrFolder(current);
          } else if (selected.text === 'Paste into current directory' || selected.text === 'Paste into this folder') {
            var isCut = false;
            var source = this.data.copyPath.split('/');
            var to = JSON.parse(JSON.stringify(this.data.paths));
            if (this.data.cutPath !== '') {
              isCut = true;
              source = this.data.cutPath.split('/');
            }
            var name = source[source.length - 1];
            source.pop();
            if (selected.text === 'Paste into this folder') {
              to.push(current.text);
            }
            if (this.data.pasteType === 'OBJECT') {
              this.$router.showLoading();
              DS.copyFolder(source, name, to.join('/'), (taskSuccess, taskFail, length) => {
                this.$router.hideLoading();
                this.data.cutPath = '';
                this.data.copyPath = '';
                this.data.pasteType = '';
                // console.log(taskSuccess, taskFail, length);
              }, (taskSuccess, taskFail, length) => {
                // console.log(taskSuccess, taskFail, length);
              }, isCut);
            } else if (this.data.pasteType === 'FILE') {
              DS.copyFile(source, name, to.join('/'), isCut)
              .then((res) => {
                if (isCut) {
                  var oldPath = [...source, name].join('/');
                  var newPath = [...to, name].join('/');
                  DS.getFile(newPath, (found) => {
                    this.methods.navigate();
                  }, (err) => {
                    this.$router.showToast(err.toString())
                    this.methods.navigate();
                  });
                } else {
                  this.methods.navigate();
                }
                this.data.cutPath = '';
                this.data.copyPath = '';
                this.data.pasteType = '';
                this.$router.showToast(res.target.result);
              })
              .catch((err) => {
                this.$router.showToast(err.toString())
              });
            }
          } else if (selected.text === 'Properties') {
            DS.getFile([...JSON.parse(JSON.stringify(this.data.paths)), current.text].join('/'), (properties) => {
              var text = '';
              if (current.kloudless_id) {
                text += 'ID: <small>' + current.kloudless_id + '</small></br>';
              }
              text += 'Name: <small>' + current.text + '</small></br>';
              text += 'Modified: <small>' + new Date(properties.lastModifiedDate).toLocaleString() + '</small></br>';
              text += 'MIME: <small>' + properties.type + '</small></br>';
              text += 'Size: <small>' + humanFileSize(properties.size) + '</small></br>';
              setTimeout(() => {
                this.$router.showDialog('Properties', text, null, 'Close', undefined, ' ', undefined, undefined, undefined, () => {
                  setTimeout(() => {
                    this.methods.renderSoftKey();
                  }, 100);
                });
              }, 110)
            });
          }
        }, () => {
          setTimeout(() => {
            this.methods.renderSoftKey();
          }, 100);
        }, 0);
      }
    },
    softKeyInputFocusText: {},
    softKeyInputFocusListener: {},
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
        this.data.currentFocus[this.data.paths.length] = this.verticalNavIndex;
        this.methods.renderSoftKey();
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
        this.data.currentFocus[this.data.paths.length] = this.verticalNavIndex;
        this.methods.renderSoftKey();
      },
      arrowLeft: function() {
        // this.navigateTabNav(1);
      },
    }
  });

  const readMe = new Kai({
    name: '_readMe_',
    data: {
      title: '_readMe_'
    },
    templateUrl: document.location.origin + '/templates/read_me.html',
    mounted: function() {
      this.$router.setHeaderTitle('Read Me');
    },
    unmounted: function() {},
    methods: {},
    softKeyText: { left: '', center: '', right: '' },
    softKeyListener: {
      left: function() {},
      center: function() {},
      right: function() {}
    }
  });

  const router = new KaiRouter({
    title: 'File Manager',
    routes: {
      'index' : {
        name: 'mainPage',
        component: mainPage
      },
      'readMe' : {
        name: 'readMe',
        component: readMe
      }
    }
  });

  const app = new Kai({
    name: '_APP_',
    data: {},
    templateUrl: document.location.origin + '/templates/template.html',
    mounted: function() {},
    unmounted: function() {},
    router,
    state
  });

  try {
    app.mount('app');
  } catch(e) {
    console.log(e);
  }

  function onChange(fileRegistry, documentTree, groups) {
    state.setState('fileRegistry', fileRegistry);
    state.setState('documentTree', documentTree);
  }

  function onReady(status) {
    if (app.isMounted) {
      if (status) {
        app.$router.hideLoading();
      } else {
        app.$router.showLoading();
      }
    }
  }

  const DS = new DataStorage(onChange, onReady);

  function displayKaiAds() {
    var display = true;
    if (window['kaiadstimer'] == null) {
      window['kaiadstimer'] = new Date();
    } else {
      var now = new Date();
      if ((now - window['kaiadstimer']) < 300000) {
        display = false;
      } else {
        window['kaiadstimer'] = now;
      }
    }
    console.log('Display Ads:', display);
    if (!display)
      return;
    getKaiAd({
      publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
      app: 'kfm',
      slot: 'kaios',
      onerror: err => console.error(err),
      onready: ad => {
        ad.call('display')
        ad.on('close', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
        ad.on('display', () => {
          app.$router.hideBottomSheet();
          document.body.style.position = '';
        });
      }
    })
  }

  displayKaiAds();

  document.addEventListener('visibilitychange', function(ev) {
    if (document.visibilityState === 'visible') {
      displayKaiAds();
    }
  });

});
