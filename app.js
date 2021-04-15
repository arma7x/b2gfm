window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

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

  function getKloudlessFolderId(ACCOUNT, paths, folder_id, successCb, failCb) {
    if (paths.length === 0) {
      successCb(folder_id);
      return;
    }
    const folder_name = paths.shift();
    ACCOUNT.get({ url: 'storage/folders/' + folder_id + '/contents' })
    .then((response) => {
      if (response.data.objects.length === 0) {
        ACCOUNT.post({ url: 'storage/folders', data: { parent_id: folder_id, name: folder_name } })
        .then((response) => {
          if (paths.length === 0) {
            successCb(response.data.id);
          } else {
            getKloudlessFolderId(ACCOUNT, paths, response.data.id, successCb, failCb)
          }
        })
        .catch((err) => {
          failCb(err);
        });
      } else {
        
        const idx = response.data.objects.findIndex((folder) => {
          if ( folder.type === 'folder' && folder.name === folder_name) {
            return true
          }
        });

        if (idx === -1) {
          ACCOUNT.post({ url: 'storage/folders', data: { parent_id: folder_id, name: folder_name } })
          .then((response) => {
            if (paths.length === 0) {
              successCb(response.data.id);
            } else {
              getKloudlessFolderId(ACCOUNT, paths, response.data.id, successCb, failCb)
            }
          })
          .catch((err) => {
            failCb(err);
          });
        } else {
          if (paths.length === 0) {
            successCb(response.data.objects[idx].id);
          } else {
            getKloudlessFolderId(ACCOUNT, paths, response.data.objects[idx].id, successCb, failCb)
          }
        }
      }
    })
    .catch((err) => {
      failCb(err);
    });
  }

  const textViewerPage = function($router, text) {
    $router.push(
      new Kai({
        name: 'textViewerPage',
        data: {
          title: 'textViewerPage'
        },
        template: '<div style="padding:4px;white-space:pre-wrap!important;word-break:break-word!important;"><style>img{width:100%;height:auto;}.kui-software-key,.kui-header{height:0px;}.kui-router-m-top{margin-top:0;}</style>' + DOMPurify.sanitize(snarkdown(text)) + '</div>',
        mounted: function() {},
        unmounted: function() {},
        methods: {},
        softKeyText: { left: '', center: '', right: '' },
        softKeyListener: {
          left: function() {},
          center: function() {},
          right: function() {}
        }
      })
    );
  }

  const newFolderPage = function(paths) {
    return new Kai({
      name: '_newFolderPage_',
      data: {
        title: '_newFolderPage_',
        paths: paths
      },
      verticalNavClass: '.newFolderPageNav',
      templateUrl: document.location.origin + '/templates/new_folder.html',
      mounted: function() {
        this.$router.setHeaderTitle('New Folder');
      },
      unmounted: function() {},
      methods: {
        createNewFolder: function() {
          var name = document.getElementById('name');
          if (name.value == '') {
            this.$router.showToast('Please enter folder name');
            return
          }
          DS.newFolder(JSON.parse(JSON.stringify(this.data.paths)), name.value)
          .then((res) => {
            this.$router.showToast(res.target.result);
            this.$router.pop();
          })
          .catch((err) => {
            this.$router.showToast(err.toString());
          });
        }
      },
      softKeyInputFocusText: { right: 'Done' },
      softKeyInputFocusListener: {
        right: function() {
          document.activeElement.blur();
        }
      },
      softKeyText: { left: 'Cancel', center: '', right: 'OK' },
      softKeyListener: {
        left: function() {
          this.$router.pop();
        },
        right: function() {
          this.methods.createNewFolder();
        }
      },
      dPadNavListener: {
        arrowUp: function() {
          this.navigateListNav(-1);
        },
        arrowRight: function() {
          this.navigateTabNav(-1);
        },
        arrowDown: function() {
          this.navigateListNav(1);
        },
        arrowLeft: function() {
          this.navigateTabNav(1);
        },
      }
    });
  }

  const kloudlessPage = function($router) {
    localforage.getItem('KLOUDLESS_API_KEY')
    .then((KLOUDLESS_API_KEY) => {
      $router.push(new Kai({
        name: '_kloudlessPage_',
        data: {
          title: '_kloudlessPage_',
          KLOUDLESS_API_KEY: KLOUDLESS_API_KEY
        },
        verticalNavClass: '.kloudlessPageNav',
        templateUrl: document.location.origin + '/templates/kloudless.html',
        mounted: function() {
          this.$router.setHeaderTitle('Kloudless');
        },
        unmounted: function() {},
        methods: {
          selected: function(val) {
            if (typeof val === 'string') {
              if (val === 'RESET') {
                this.$router.showDialog('Confirm ?', 'Are sure to full reset ?', null, 'Yes', () => {
                  localforage.clear().then(() => {
                    this.$router.showToast('OK');
                    this.$router.pop();
                  }).catch((err) => {
                    this.$router.showToast(err.toString());
                  });
                }, 'Cancel', undefined, undefined);
              } else if (val === 'SETUP') {
                _this = this;
                DS.getFile('kloudless.txt', (found) => {
                  if (found.type === 'text/plain') {
                    var reader = new FileReader();
                    reader.onload = (event) => {
                      if (event.target.result.length > 0) {
                        localforage.setItem('KLOUDLESS_API_KEY', event.target.result)
                        .then(() => {
                          return localforage.getItem('KLOUDLESS_API_KEY');
                        }).then((value) => {
                          localforage.removeItem('KLOUDLESS_DEFAULT_ACCOUNT_ID');
                          localforage.removeItem('KLOUDLESS_DEFAULT_ACCOUNT_NAME');
                          _this.setData({ KLOUDLESS_API_KEY: value });
                          this.$router.showToast('Success');
                        }).catch((err) => {
                          this.$router.showToast(err.toString());
                        });
                      } else {
                        this.$router.showToast('Empty file');
                      }
                    };
                    reader.readAsText(found);
                  } else {
                    this.$router.showToast('Invalid MIME');
                  }
                }, (err) => {
                  this.$router.showToast(err.name);
                });
              } else if (val === 'SELECT_DEFAULT_STORAGE') {
                this.$router.showLoading();
                Kloudless.sdk.axios.get('https://api.kloudless.com/v1/accounts', {
                  headers: { 'Authorization': 'APIKey ' + this.data.KLOUDLESS_API_KEY }
                })
                .then((res) => {
                  const opts = res.data.objects;
                  for (var t in opts) {
                    opts[t]['text'] = opts[t]['service_name'] + ' - ' + opts[t]['id'];
                  }
                  localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT_ID')
                  .then((KLOUDLESS_DEFAULT_ACCOUNT_ID) => {
                    const idx = opts.findIndex((opt) => {
                      return opt.id === KLOUDLESS_DEFAULT_ACCOUNT_ID;
                    });
                    this.$router.showSingleSelector('Select', opts, 'Select', (selected) => {
                      localforage.setItem('KLOUDLESS_DEFAULT_ACCOUNT_ID', selected.id)
                      .then(() => {
                        localforage.setItem('KLOUDLESS_DEFAULT_ACCOUNT_NAME', selected['service_name'] + ' - ' + selected['id'])
                        localforage.getItem('KLOUDLESS_ACCOUNT_' + selected['id'])
                        .then((KLOUDLESS_DEFAULT_ACCOUNT) => {
                          if (KLOUDLESS_DEFAULT_ACCOUNT == null) {
                            localforage.setItem('KLOUDLESS_ACCOUNT_' + selected['id'], {});
                          }
                        })
                        .catch((err) => {
                          this.$router.showToast(err.toString());
                        });
                        this.$router.showToast(selected['service_name'] + ' - ' + selected['id']);
                      }).catch((err) => {
                        this.$router.showToast(err.toString());
                      });
                    }, 'Cancel', null, undefined, idx);
                  })
                  .catch((err) => {
                    this.$router.showToast(err.toString());
                  });
                })
                .catch((err) => {
                  this.$router.showToast(err.toString());
                })
                .finally((err) => {
                  this.$router.hideLoading();
                });
              } else if (val === 'OPEN_DEFAULT_STORAGE') {
                cloudStoragePage(this.$router, this.data.KLOUDLESS_API_KEY);
              } else if (val === "FIX") {
                localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT_ID')
                .then((KLOUDLESS_DEFAULT_ACCOUNT_ID) => {
                  var ACCOUNT = new Kloudless.sdk.Account({
                    token: KLOUDLESS_API_KEY,
                    tokenType: 'APIKey',
                    accountId: KLOUDLESS_DEFAULT_ACCOUNT_ID
                  });
                  localforage.getItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID)
                  .then((objs) => {
                    var POWER;
                    var updateDatabase = (data) => {
                      if (POWER) {
                        POWER.unlock();
                      }
                      this.$router.hideLoading();
                      localforage.setItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID, data);
                      this.$router.showToast('Done');
                    }
                    const taskLength = Object.keys(objs).length;
                    if (taskLength > 0) {
                      POWER = navigator.requestWakeLock('cpu');
                    }
                    var taskDone = 0;
                    this.$router.showLoading();
                    for (var i in objs) {
                      const id = i;
                      DS.getFile(objs[id], (local) => {
                        ACCOUNT.get({ url: 'storage/files/' + id })
                        .then((cloud) => {
                          taskDone++;
                          this.$router.showToast(taskDone.toString() + '/' + taskLength.toString());
                          if (!cloud.data.downloadable) {
                            delete objs[id];
                            localforage.removeItem(id);
                          }
                          if (taskDone === taskLength) {
                            updateDatabase(objs);
                          }
                        })
                        .catch((err) => {
                          taskDone++;
                          this.$router.showToast(taskDone.toString() + '/' + taskLength.toString());
                          if (err.response) {
                            delete objs[id];
                            localforage.removeItem(id);
                          }
                          if (taskDone === taskLength) {
                            updateDatabase(objs);
                          }
                        });
                      }, (err) => {
                        taskDone++;
                        this.$router.showToast(taskDone.toString() + '/' + taskLength.toString());
                        delete objs[id];
                        localforage.removeItem(id);
                        if (taskDone === taskLength) {
                          updateDatabase(objs);
                        }
                      })
                    }
                  })
                })
                .catch((err) => {
                  console.log(err);
                });
              }
            }
          }
        },
        softKeyInputFocusText: {},
        softKeyInputFocusListener: {
          right: function() {}
        },
        softKeyText: { left: '', center: 'SELECT', right: '' },
        softKeyListener: {
          left: function() {},
          center: function() {
            const listNav = document.querySelectorAll(this.verticalNavClass);
            if (this.verticalNavIndex > -1) {
              listNav[this.verticalNavIndex].click();
            }
          },
          right: function() {}
        },
        dPadNavListener: {
          arrowUp: function() {
            this.navigateListNav(-1);
          },
          arrowRight: function() {
            this.navigateTabNav(-1);
          },
          arrowDown: function() {
            this.navigateListNav(1);
          },
          arrowLeft: function() {
            this.navigateTabNav(1);
          },
        }
      }));
    })
    .catch((err) => {
      $router.showToast(err.toString());
    });
  }

  const cloudStoragePage = function($router, KLOUDLESS_API_KEY) {
    localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT_ID')
    .then((KLOUDLESS_DEFAULT_ACCOUNT_ID) => {
      if (KLOUDLESS_DEFAULT_ACCOUNT_ID == null) {
        $router.showToast('Please select default cloud storage');
      } else {
        localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT_NAME')
        .then((KLOUDLESS_DEFAULT_ACCOUNT_NAME) => {
          var ACCOUNT = new Kloudless.sdk.Account({
            token: KLOUDLESS_API_KEY,
            tokenType: 'APIKey',
            accountId: KLOUDLESS_DEFAULT_ACCOUNT_ID
          });
          $router.push(new Kai({
            name: '_cloudStoragePage_',
            data: {
              title: '_cloudStoragePage_',
              parent: null,
              previousPaths: [],
              currentPaths: [],
              currentFolderContents: [],
              currentFocus: [0]
            },
            verticalNavClass: '.kloudlessPageNav',
            templateUrl: document.location.origin + '/templates/cloudstorage.html',
            mounted: function() {
              this.$router.setHeaderTitle(KLOUDLESS_DEFAULT_ACCOUNT_NAME);
              this.methods.navigate('root', () => {
                this.verticalNavIndex = this.data.currentFocus[this.data.previousPaths.length];
              });
            },
            unmounted: function() {},
            methods: {
              filteringSyncFiles: function() {
                localforage.getItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID)
                .then((objs) => {
                  for (var x in this.data.currentFolderContents) {
                    for( var y in objs) {
                      if (this.data.currentFolderContents[x].type === 'file' && this.data.currentFolderContents[x].id === y) {
                        this.data.currentFolderContents[x]['local_path'] = objs[y];
                        this.data.currentFolderContents[x]['sync'] = true;
                        this.data.currentFolderContents[x]['icon'] = 'local.png';
                        delete objs[y];
                        break;
                      }
                    }
                  }
                  this.render()
                })
                .catch((err) => {
                  this.$router.showToast(err.toString())
                });
              },
              navigate: function(folder_id, cb) {
                this.$router.showLoading();
                ACCOUNT.get({
                  url: 'storage/folders/' + folder_id
                }).then((response) => {
                  if (response.data.parent == null) {
                    this.data.parent = 'root';
                  } else {
                    this.data.parent = response.data.parent.id
                  }
                  cb(response.data);
                  return ACCOUNT.get({ url: 'storage/folders/' + folder_id + '/contents' });
                }).then((response) => {
                  this.data.currentFolderContents = []
                  for (var x in response.data.objects) {
                    response.data.objects[x]['text'] = response.data.objects[x]['name']
                    response.data.objects[x]['icon'] = 'unknown.png'
                    if (response.data.objects[x].type === 'folder') {
                      response.data.objects[x]['icon'] = 'folder.png'
                    } else if (response.data.objects[x].type === 'file') {
                      response.data.objects[x]['sync'] = false;
                      const n2 = response.data.objects[x].mime_type.split('/');
                      if (n2[0] === 'text') {
                        response.data.objects[x]['icon'] = "text.png";
                      } else if (n2[0] === 'audio') {
                        response.data.objects[x]['icon'] = "audio.png";
                      } else if (n2[0] === 'video') {
                        response.data.objects[x]['icon'] = "video.png";
                      } else if (n2[0] === 'image') {
                        response.data.objects[x]['icon'] = "image.png";
                      }
                    }
                    this.data.currentFolderContents.push(response.data.objects[x])
                  }
                  if (this.data.currentFocus[this.data.previousPaths.length] >= this.data.currentFolderContents.length) {
                    this.data.currentFocus[this.data.previousPaths.length] = this.data.currentFolderContents.length - 1;
                    this.verticalNavIndex = this.data.currentFocus[this.data.previousPaths.length];
                  }
                  var current = this.data.currentFolderContents[this.data.currentFocus[this.data.previousPaths.length]];
                  if (current == null) {
                    this.$router.setSoftKeyText('Exit', '', '');
                  } else if (current.type === 'file') {
                    this.$router.setSoftKeyText('Exit', '', 'Option');
                  } else if (current.type === 'folder') {
                    this.$router.setSoftKeyText('Exit', 'OPEN', '');
                  }
                  this.$router.setHeaderTitle(KLOUDLESS_DEFAULT_ACCOUNT_NAME + '(' + (this.data.currentFocus.length - 1).toString() + ')');
                  this.methods.filteringSyncFiles();
                }).catch((err) => {
                  this.$router.showToast(err.toString())
                }).finally(() => {
                  this.$router.hideLoading();
                });
              },
              selected: function() {
                var current = this.data.currentFolderContents[this.data.currentFocus[this.data.previousPaths.length]];
                if (current.type === 'folder') {
                  this.methods.navigate(current.id, (data) => {
                    this.data.currentPaths.push(data.name);
                    this.data.previousPaths.push(this.data.parent)
                    this.data.currentFocus.push(0);
                    this.verticalNavIndex = this.data.currentFocus[this.data.previousPaths.length];
                  });
                }
              },
            },
            softKeyInputFocusText: {},
            softKeyInputFocusListener: {
              right: function() {}
            },
            backKeyListener: function() {
              if (this.data.previousPaths.length > 0) {
                var parent = this.data.previousPaths[this.data.previousPaths.length - 1]
                this.methods.navigate(parent, () => {
                  this.data.currentPaths.pop();
                  this.data.previousPaths.pop();
                  this.verticalNavIndex = this.data.currentFocus[this.data.previousPaths.length];
                  this.data.currentFocus.pop();
                });
                return true;
              }
            },
            softKeyText: { left: 'Exit', center: '', right: '' },
            softKeyListener: {
              left: function() {
                this.$router.pop();
              },
              center: function() {
                const listNav = document.querySelectorAll(this.verticalNavClass);
                if (this.verticalNavIndex > -1) {
                  listNav[this.verticalNavIndex].click();
                }
              },
              right: function() {
                var current = this.data.currentFolderContents[this.data.currentFocus[this.data.previousPaths.length]];
                if (current.type === 'file') {
                  var options = []
                  if (!current.sync) {
                    options.push({ "text": "Download"});
                  }
                  options.push({ "text": "Delete"});
                  options.push({ "text": "Properties"})
                  this.$router.showOptionMenu('Option', options, 'Select', (selected) => {
                    if (selected.text === 'Download') {
                      this.$router.showLoading();
                      var offlinePath = [...this.data.currentPaths, current.text].join('/');
                      const saveOffline = () => {
                        var POWER = navigator.requestWakeLock('cpu');
                        ACCOUNT.get({ url: `storage/files/${current.id}/contents/` })
                        .then((binary) => {
                          POWER.unlock();
                          DS.addFile(JSON.parse(JSON.stringify(this.data.currentPaths)), current.text, binary.data)
                          .then((result) => {
                            return localforage.getItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID)
                            .then((objs) => {
                              if (objs) {
                                objs[current.id] = offlinePath;
                              } else {
                                objs = {};
                              }
                              return localforage.setItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID, objs)
                              .then(() => {
                                return localforage.setItem(current.id, [current.modified, result.lastModifiedDate]);
                              });
                            });
                          })
                          .then(() => {
                            this.methods.filteringSyncFiles();
                            this.$router.showToast("Saved to local storage");
                            this.$router.hideLoading();
                          })
                          .catch((err) => {
                            this.$router.hideLoading();
                            this.$router.showToast(err.toString());
                          });
                        })
                        .catch((err) => {
                          POWER.unlock();
                          this.$router.hideLoading();
                          this.$router.showToast(err.toString());
                        });
                      }
                      DS.getFile(offlinePath, (found) => {
                        if (new Date(found.lastModifiedDate) > new Date(current.modified)) {
                          localforage.getItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID)
                          .then((objs) => {
                            if (objs) {
                              objs[current.id] = offlinePath;
                            } else {
                              objs = {};
                            }
                            return localforage.setItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID, objs)
                            .then(() => {
                              return localforage.setItem(current.id, [current.modified, found.lastModifiedDate]);
                            });
                          })
                          .then(() => {
                            this.methods.filteringSyncFiles();
                            this.$router.showToast('The file version on cloud storage is outdated');
                            this.$router.hideLoading();
                          })
                          .catch((err) => {
                            this.$router.hideLoading();
                            this.$router.showToast(err.toString());
                          });
                        } else {
                          saveOffline();
                        }
                      }, (notfound) => {
                        saveOffline();
                      });
                    } else if (selected.text === 'Delete') {
                      this.$router.showLoading();
                      ACCOUNT.delete({ url: `storage/files/${current.id}` })
                      .then(() => {
                        this.$router.showToast("OK");
                        this.$router.hideLoading();
                        localforage.getItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID)
                        .then((objs) => {
                          if (objs) {
                            delete objs[current.id];
                          } else {
                            objs = {};
                          }
                          return localforage.setItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID, objs)
                          .then(() => {
                            return localforage.removeItem(current.id);
                          });
                        })
                        .then(() => {
                          var idx = -1;
                          this.data.currentFolderContents.forEach((x, i) => {
                            if (x.id === current.id) {
                              idx = i;
                            }
                          });
                          if (idx > -1) {
                            this.data.currentFolderContents.splice(idx, 1);
                            if (this.verticalNavIndex > 0) {
                              this.verticalNavIndex = this.verticalNavIndex - 1;
                              this.data.currentFocus[this.data.previousPaths.length] = this.verticalNavIndex;
                            }
                          }
                          this.methods.filteringSyncFiles();
                        });
                      })
                      .catch((err) => {
                        this.$router.hideLoading();
                        this.$router.showToast(err.toString());
                      });
                    } else if (selected.text === 'Properties') {
                      var text = '';
                      text += 'ID: <small>' + current.id + '</small></br>';
                      text += 'Name: <small>' + current.name + '</small></br>';
                      text += 'Sync: <small>' + current.sync + '</small></br>';
                      text += 'Modified: <small>' + new Date(current.modified).toLocaleString() + '</small></br>';
                      text += 'MIME: <small>' + current.mime_type + '</small></br>';
                      text += 'Size: <small>' + humanFileSize(current.size) + '</small></br>';
                      setTimeout(() => {
                        this.$router.showDialog('Properties', text, null, 'Close', undefined, ' ', undefined, undefined, undefined, () => {
                          setTimeout(() => {
                            if (current == null) {
                              this.$router.setSoftKeyText('Exit', '', '');
                            } else if (current.type === 'file') {
                              this.$router.setSoftKeyText('Exit', '', 'Option');
                            } else if (current.type === 'folder') {
                              this.$router.setSoftKeyText('Exit', 'OPEN', '');
                            }
                          }, 100);
                        });
                      }, 110);
                    }
                  }, () => {
                    setTimeout(() => {
                      if (current == null) {
                        this.$router.setSoftKeyText('Exit', '', '');
                      } else if (current.type === 'file') {
                        this.$router.setSoftKeyText('Exit', '', 'Option');
                      } else if (current.type === 'folder') {
                        this.$router.setSoftKeyText('Exit', 'OPEN', '');
                      }
                    }, 100);
                  }, 0);
                  
                }
              }
            },
            dPadNavListener: {
              arrowUp: function() {
                this.navigateListNav(-1);
                this.data.currentFocus[this.data.previousPaths.length] = this.verticalNavIndex;
                var current = this.data.currentFolderContents[this.data.currentFocus[this.data.previousPaths.length]];
                if (current == null) {
                  this.$router.setSoftKeyText('Exit', '', '');
                } else if (current.type === 'file') {
                  this.$router.setSoftKeyText('Exit', '', 'Option');
                } else if (current.type === 'folder') {
                  this.$router.setSoftKeyText('Exit', 'OPEN', '');
                }
              },
              arrowRight: function() {
                this.navigateTabNav(-1);
              },
              arrowDown: function() {
                this.navigateListNav(1);
                this.data.currentFocus[this.data.previousPaths.length] = this.verticalNavIndex;
                var current = this.data.currentFolderContents[this.data.currentFocus[this.data.previousPaths.length]];
                if (current == null) {
                  this.$router.setSoftKeyText('Exit', '', '');
                } else if (current.type === 'file') {
                  this.$router.setSoftKeyText('Exit', '', 'Option');
                } else if (current.type === 'folder') {
                  this.$router.setSoftKeyText('Exit', 'OPEN', '');
                }
              },
              arrowLeft: function() {
                this.navigateTabNav(1);
              },
            }
          }));
        })
        .catch((err) => {
          $router.showToast(err.toString())
        });
      }
    })
    .catch((err) => {
      $router.showToast(err.toString())
    });
  }

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
        { "text": "Kloudless" },
        { "text": "Read Me" }
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
            documentTree = documentTree[this.data.paths[x]]
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
                icon = "text.png";
                launcher = 'text';
              } else if (n2[0] === 'audio') {
                icon = "audio.png";
                launcher = 'audio';
              } else if (n2[0] === 'video') {
                icon = "video.png";
                launcher = 'video';
              } else if (n2[0] === 'image') {
                icon = "image.png";
                launcher = 'image';
              }
            }
          }
          this.data.currentFolderContents.push({text: x, type, icon, isFile, sync: false, launcher: launcher})
        }
        if (this.data.currentFocus[this.data.paths.length] >= this.data.currentFolderContents.length) {
          this.data.currentFocus[this.data.paths.length] = this.data.currentFolderContents.length - 1;
          this.verticalNavIndex = this.data.currentFocus[this.data.paths.length];
        }
        localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT_ID')
        .then((KLOUDLESS_DEFAULT_ACCOUNT_ID) => {
          return localforage.getItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID)
        })
        .then((objs) => {
          for (var i in this.data.currentFolderContents) {
            if (this.data.currentFolderContents[i].isFile) {
              var path = [...this.data.paths, this.data.currentFolderContents[i].text].join('/');
              for (var j in objs) {
                if (objs[j] === path) {
                  this.data.currentFolderContents[i]['kloudless_id'] = j;
                  this.data.currentFolderContents[i]['sync'] = true;
                  this.data.currentFolderContents[i]['icon'] = 'cloud.png';
                  delete objs[j];
                  break;
                }
              }
            }
          }
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
          this.render()
        })
        .catch((err) => {
          this.render()
          this.$router.showToast(err.toString())
        });
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
                var reader = new FileReader();
                reader.onload = (event) => {
                  textViewerPage(this.$router, event.target.result);
                };
                reader.readAsText(_file);
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
                localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT_ID')
                .then((KLOUDLESS_DEFAULT_ACCOUNT_ID) => {
                  localforage.getItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID)
                  .then((objs) => {
                    delete objs[current.kloudless_id];
                    localforage.setItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID, objs)
                    .then(() => {
                      localforage.removeItem(current.kloudless_id);
                      this.methods.navigate();
                    });
                  });
                });
              })
              .catch((err) => {
                this.$router.showToast(err.toString())
              });
            }
          }, 'Cancel', undefined, undefined);
        }, 110);
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
            this.$router.push(newFolderPage(JSON.parse(JSON.stringify(this.data.paths))));
          } else if (selected.text === 'Kloudless') {
            kloudlessPage(this.$router);
          } else if (selected.text === 'Read Me') {
            this.$router.push('readMe');
          }
        }, () => {
          var current = this.data.currentFolderContents[this.verticalNavIndex];
          setTimeout(() => {
            if (this.$router.stack[this.$router.stack.length - 1].name === '_main_') {
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
          if (current.sync) {
            options.push({ "text": "Sync"})
            options.push({ "text": "Unlink"})
          } else {
            options.push({ "text": "Upload"})
          }
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
                    localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT_ID')
                    .then((KLOUDLESS_DEFAULT_ACCOUNT_ID) => {
                      localforage.getItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID)
                      .then((objs) => {
                        var idx;
                        for (var y in objs) {
                          if (objs[y] === oldPath) {
                            objs[y] = newPath;
                            idx = y;
                            break
                          }
                        }
                        localforage.setItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID, objs)
                        .then(() => {
                          localforage.getItem(idx)
                          .then((history) => {
                            var last = history.pop();
                            history.push(found.lastModifiedDate.toISOString());
                            history.push(last);
                            localforage.setItem(idx, history);
                          });
                          this.methods.navigate();
                        })
                        .catch((err) => {
                          this.$router.showToast(err.toString())
                          this.methods.navigate();
                        });
                      })
                      .catch((err) => {
                        this.$router.showToast(err.toString())
                        this.methods.navigate();
                      });
                    })
                    .catch((err) => {
                      this.$router.showToast(err.toString())
                      this.methods.navigate();
                    });
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
          } else if (selected.text === 'Unlink') {
            var _KLOUDLESS_DEFAULT_ACCOUNT_ID;
            localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT_ID')
            .then((KLOUDLESS_DEFAULT_ACCOUNT_ID) => {
              _KLOUDLESS_DEFAULT_ACCOUNT_ID = KLOUDLESS_DEFAULT_ACCOUNT_ID;
              return localforage.getItem('KLOUDLESS_ACCOUNT_' + KLOUDLESS_DEFAULT_ACCOUNT_ID)
            })
            .then((objs) => {
              if (objs != null) {
                delete objs[current.kloudless_id];
              } else {
                objs = {};
              }
              return localforage.setItem('KLOUDLESS_ACCOUNT_' + _KLOUDLESS_DEFAULT_ACCOUNT_ID, objs)
            })
            .then(() => {
              localforage.removeItem(current.kloudless_id)
              this.methods.navigate();
            })
            .catch((err) => {
              this.$router.showToast(err.toString())
            });
          } else if (selected.text === 'Sync') {
            localforage.getItem('KLOUDLESS_API_KEY')
            .then((KLOUDLESS_API_KEY) => {
              return localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT_ID')
              .then((KLOUDLESS_DEFAULT_ACCOUNT_ID) => {
                return Promise.resolve({KLOUDLESS_API_KEY, KLOUDLESS_DEFAULT_ACCOUNT_ID})
              });
            })
            .then((ACC) => {
              var ACCOUNT = new Kloudless.sdk.Account({
                token: ACC.KLOUDLESS_API_KEY,
                tokenType: 'APIKey',
                accountId: ACC.KLOUDLESS_DEFAULT_ACCOUNT_ID
              });
              this.$router.showLoading();
              ACCOUNT.get({ url: 'storage/files/' + current.kloudless_id })
              .then((cloud) => {
                DS.getFile([...JSON.parse(JSON.stringify(this.data.paths)), current.text].join('/'), (local) => {
                  localforage.getItem(current.kloudless_id)
                  .then((history) => {
                    const lastVersion = new Date(history[history.length - 1]);
                    if (history.indexOf(cloud.data.modified) == -1 && history.indexOf(local.lastModifiedDate.toISOString()) != -1 && (new Date(cloud.data.modified) > lastVersion)) {
                      var POWER = navigator.requestWakeLock('cpu');
                      ACCOUNT.get({ url: `storage/files/${current.kloudless_id}/contents/` })
                      .then((binary) => {
                        POWER.unlock();
                        DS.addFile(JSON.parse(JSON.stringify(this.data.paths)), local.name, binary.data)
                        .then((result) => {
                          return localforage.setItem(current.kloudless_id, [...history, cloud.data.modified, result.lastModifiedDate]);
                        })
                        .then(() => {
                          this.$router.showToast("Sync from cloud to local");
                          this.$router.hideLoading();
                        })
                        .catch((err) => {
                          this.$router.hideLoading();
                          this.$router.showToast(err.toString());
                        });
                      })
                      .catch((err) => {
                        POWER.unlock();
                        this.$router.hideLoading();
                        this.$router.showToast(err.toString());
                      });
                    } else if (history.indexOf(cloud.data.modified) != -1 && history.indexOf(local.lastModifiedDate.toISOString()) == -1 && (local.lastModifiedDate > lastVersion)) {
                      var reader = new FileReader();
                      reader.onload = (evt) => {
                        var POWER = navigator.requestWakeLock('cpu');
                        ACCOUNT.post({ url: 'storage/files', headers: { 'X-Kloudless-Metadata': { parent_id: cloud.data.parent.id, name: cloud.data.name } }, params: { overwrite: true }, data: evt.target.result })
                        .then((resource) => {
                          POWER.unlock();
                          return localforage.setItem(current.kloudless_id, [...history, local.lastModifiedDate, resource.data.modified]);
                        })
                        .then(() => {
                          this.$router.showToast("Sync from local to cloud");
                          this.$router.hideLoading();
                        })
                        .catch((err) => {
                          POWER.unlock();
                          this.$router.showToast(err.toString());
                          this.$router.hideLoading();
                        });
                      };
                      reader.onerror = (err) => {
                        this.$router.showToast(err.toString());
                        this.$router.hideLoading();
                      };
                      reader.readAsArrayBuffer(local);
                    } else if (history.indexOf(cloud.data.modified) == -1 && history.indexOf(local.lastModifiedDate.toISOString()) == -1) {
                      this.$router.showToast("VERSION COLLISION");
                      this.$router.hideLoading();
                    } else if (history.indexOf(cloud.data.modified) != -1 && history.indexOf(local.lastModifiedDate.toISOString()) != -1) {
                      this.$router.showToast("UP-TO-DATE");
                      this.$router.hideLoading();
                    } else {
                      this.$router.showToast('UNKNOWN ERROR');
                      this.$router.hideLoading();
                    }
                  });
                }, (err) => {
                  this.$router.hideLoading();
                  this.$router.showToast(err.toString());
                }, true);
              })
              .catch((err) => {
                this.$router.hideLoading();
                this.$router.showToast(err.toString());
              })
            })
            .catch((err) => {
              this.$router.showToast(err.toString());
            });
          } else if (selected.text === 'Upload') {
            localforage.getItem('KLOUDLESS_API_KEY')
            .then((KLOUDLESS_API_KEY) => {
              if (KLOUDLESS_API_KEY == null) {
                return Promise.reject('Please setup api key')
              }
              return localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT_ID')
              .then((KLOUDLESS_DEFAULT_ACCOUNT_ID) => {
                if (KLOUDLESS_DEFAULT_ACCOUNT_ID == null) {
                  return Promise.reject('Please select default cloud storage')
                }
                return Promise.resolve({KLOUDLESS_API_KEY, KLOUDLESS_DEFAULT_ACCOUNT_ID})
              });
            })
            .then((ACC) => {
              var ACCOUNT = new Kloudless.sdk.Account({
                token: ACC.KLOUDLESS_API_KEY,
                tokenType: 'APIKey',
                accountId: ACC.KLOUDLESS_DEFAULT_ACCOUNT_ID
              });
              this.$router.showLoading();
              getKloudlessFolderId(ACCOUNT, JSON.parse(JSON.stringify(this.data.paths)), 'root', (FOLDER_ID) => {
                DS.getFile([...JSON.parse(JSON.stringify(this.data.paths)), current.text].join('/'), (file) => {
                  const NAME = file.name.split('/');
                  ACCOUNT.get({ url: 'storage/folders/' + FOLDER_ID + '/contents' })
                  .then((response) => {
                    var resume = true;
                    for (var z in response.data.objects) {
                      const x = z;
                      if (response.data.objects[x].type === 'file' && response.data.objects[x].name === NAME[NAME.length - 1]) {
                        if (new Date(response.data.objects[x].modified) > new Date(file.lastModifiedDate)) {
                          localforage.getItem('KLOUDLESS_ACCOUNT_' + ACC.KLOUDLESS_DEFAULT_ACCOUNT_ID)
                          .then((objs) => {
                            if (objs == null) {
                              objs = {}
                            }
                            objs[response.data.objects[x].id] = [...JSON.parse(JSON.stringify(this.data.paths)), current.text].join('/')
                            return localforage.setItem(response.data.objects[x].id, [file.lastModifiedDate, response.data.objects[x].modified])
                            .then(() => {
                              return localforage.setItem('KLOUDLESS_ACCOUNT_' + ACC.KLOUDLESS_DEFAULT_ACCOUNT_ID, objs)
                            });
                          })
                          .then(() => {
                            this.$router.showToast('The file version on local storage is outdated');
                            this.methods.navigate();
                            this.$router.hideLoading();
                          })
                          .catch((err) => {
                            this.$router.hideLoading();
                            this.$router.showToast(err.toString());
                          });
                          resume = false;
                          break;
                        }
                      }
                    }
                    if (resume) {
                      var reader = new FileReader();
                      reader.onload = (evt) => {
                        var POWER = navigator.requestWakeLock('cpu');
                        ACCOUNT.post({ url: 'storage/files', headers: { 'X-Kloudless-Metadata': { parent_id: FOLDER_ID, name: NAME[NAME.length - 1] } }, params: { overwrite: true }, data: evt.target.result })
                        .then((resource) => {
                          POWER.unlock();
                          localforage.getItem('KLOUDLESS_ACCOUNT_' + ACC.KLOUDLESS_DEFAULT_ACCOUNT_ID)
                          .then((objs) => {
                            if (objs == null) {
                              objs = {}
                            }
                            objs[resource.data.id] = [...JSON.parse(JSON.stringify(this.data.paths)), current.text].join('/')
                            return localforage.setItem(resource.data.id, [file.lastModifiedDate, resource.data.modified])
                            .then(() => {
                              return localforage.setItem('KLOUDLESS_ACCOUNT_' + ACC.KLOUDLESS_DEFAULT_ACCOUNT_ID, objs)
                            });
                          })
                          .then(() => {
                            this.$router.showToast('Uploaded to cloud');
                            this.methods.navigate();
                            this.$router.hideLoading();
                          })
                          .catch((err) => {
                            this.$router.hideLoading();
                            this.$router.showToast(err.toString());
                          });
                        })
                        .catch((err) => {
                          POWER.unlock();
                          this.$router.hideLoading();
                          this.$router.showToast(err.toString());
                        });
                      };
                      reader.onerror = (err) => {
                        this.$router.showToast(err.toString());
                        this.$router.hideLoading();
                      };
                      reader.readAsArrayBuffer(file);
                    }
                  })
                  .catch((err) => {
                    this.$router.hideLoading();
                    this.$router.showToast(err.toString());
                  })
                }, (err) => {
                  this.$router.showToast(err.toString());
                  this.$router.hideLoading();
                });
              }, (err) => {
                this.$router.showToast(err.toString());
                this.$router.hideLoading();
              });
            })
            .catch((err) => {
              this.$router.hideLoading();
              this.$router.showToast(err.toString());
            });
          } else if (selected.text === 'Properties') {
            DS.getFile([...JSON.parse(JSON.stringify(this.data.paths)), current.text].join('/'), (properties) => {
              var text = '';
              if (current.kloudless_id) {
                text += 'ID: <small>' + current.kloudless_id + '</small></br>';
              }
              text += 'Name: <small>' + current.text + '</small></br>';
              text += 'Sync: <small>' + current.sync + '</small></br>';
              text += 'Modified: <small>' + new Date(properties.lastModifiedDate).toLocaleString() + '</small></br>';
              text += 'MIME: <small>' + properties.type + '</small></br>';
              text += 'Size: <small>' + humanFileSize(properties.size) + '</small></br>';
              setTimeout(() => {
                this.$router.showDialog('Properties', text, null, 'Close', undefined, ' ', undefined, undefined, undefined, () => {
                  setTimeout(() => {
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
                  }, 100);
                });
              }, 110)
            });
          }
        }, () => {
          setTimeout(() => {
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
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
        this.data.currentFocus[this.data.paths.length] = this.verticalNavIndex;
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
    },
    dPadNavListener: {
      arrowUp: function() {
      },
      arrowDown: function() {
      }
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
    getKaiAd({
      publisher: 'ac3140f7-08d6-46d9-aa6f-d861720fba66',
      app: 'kfm',
      slot: 'kaios',
      onerror: err => console.error(err),
      onready: ad => {
        ad.call('display')
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
