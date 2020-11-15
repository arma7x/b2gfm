window.addEventListener("load", function() {

  localforage.setDriver(localforage.LOCALSTORAGE);

  document.addEventListener('visibilitychange', function(ev) {
    console.log(`Tab state : ${document.visibilityState}`);
  });

  const state = new KaiState({
    'counter': -1,
    'editor': '',
    'fileRegistry': [],
    'documentTree': {}
  });

  function onChange(fileRegistry, documentTree, groups) {
    state.setState('fileRegistry', fileRegistry);
    state.setState('documentTree', documentTree);
  }

  const DS = new DataStorage(onChange);

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
            if (err) {
              this.$router.showToast(err.name);
            } else {
              this.$router.showToast('Unknown Error');
            }
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
    // localforage.clear()
    localforage.getItem('KLOUDLESS_API_KEY')
    .then((value) => {
      $router.push(new Kai({
        name: '_kloudlessPage_',
        data: {
          title: '_kloudlessPage_',
          KLOUDLESS_API_KEY: value
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
              if (val === 'SETUP') {
                this.methods.setupApiKey();
              } else if (val === 'CHANGE_DEFAULT') {
                this.$router.showLoading();
                Kloudless.sdk.axios.get('https://api.kloudless.com/v1/accounts', {
                  headers: { 'Authorization': 'APIKey ' + this.data.KLOUDLESS_API_KEY }
                })
                .then((res) => {
                  const opts = res.data.objects;
                  for (var t in opts) {
                    opts[t]['text'] = opts[t]['service_name'] + ' - ' + opts[t]['id'];
                  }
                  localforage.getItem('KLOUDLESS_DEFAULT_ACCOUNT')
                  .then((KLOUDLESS_DEFAULT_ACCOUNT) => {
                    const idx = opts.findIndex((opt) => {
                      return opt.id === KLOUDLESS_DEFAULT_ACCOUNT;
                    });
                    this.$router.showSingleSelector('Select', opts, 'Select', (selected) => {
                      localforage.setItem('KLOUDLESS_DEFAULT_ACCOUNT', selected.id)
                      .then(() => {
                        this.$router.showToast(selected['service_name'] + ' - ' + selected['id']);
                      }).catch((err) => {
                        console.log(err);
                      });
                    }, 'Cancel', null, idx);
                  })
                  .catch((err) => {
                    console.log(err);
                  });
                })
                .catch((err) => {
                  console.log(err);
                })
                .finally((err) => {
                  this.$router.hideLoading();
                });
              }
            }
          },
          setupApiKey: function() {
            _this = this;
            DS.getFile('kloudless.txt', (found) => {
              if (found.type === 'text/plain') {
                var reader = new FileReader();
                reader.onload = (event) => {
                  if (event.target.result.length > 0) {
                    console.log(event.target.result);
                    localforage.setItem('KLOUDLESS_API_KEY', event.target.result)
                    .then(() => {
                      return localforage.getItem('KLOUDLESS_API_KEY');
                    }).then((value) => {
                      _this.setData({ KLOUDLESS_API_KEY: value });
                      console.log(value);
                    }).catch((err) => {
                      console.log(err);
                    });
                  } else {
                    console.log('Empty file');
                  }
                };
                reader.readAsText(found);
              } else {
                console.log('Invalid MIME');
              }
            }, (err) => {
              this.$router.showToast(err.name);
            });
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
      console.log(err);
    });
  }

  const mainPage = new Kai({
    name: '_main_',
    data: {
      title: '_main_',
      counter: -1,
      selected: 'None',
      paths: [],
      currentFolderContents: [],
      currentFocus: [0],
      copyPath: '',
      cutPath: '',
      pasteType: '',
      menu: [
        { "text": "Create new folder" },
        { "text": "Kloudless" }
      ]
    },
    verticalNavClass: '.mainNav',
    components: [],
    templateUrl: document.location.origin + '/templates/main.html',
    mounted: function() {
      this.$router.setHeaderTitle('File Manager');
      this.$state.addGlobalListener(this.methods.listenState);
      this.methods.navigate();
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
        this.data.currentFolderContents = []
        for (var x in documentTree) {
          var type = 'FILE'
          var icon = '&#128240'
          if (typeof documentTree[x] === 'object') {
            type = 'OBJECT'
            icon = '&#128193'
          }
          this.data.currentFolderContents.push({text: x, type: type, icon})
        }
        if (this.data.currentFocus[this.data.paths.length] >= this.data.currentFolderContents.length) {
          this.data.currentFocus[this.data.paths.length] = this.data.currentFolderContents.length - 1;
          this.verticalNavIndex = this.data.currentFocus[this.data.paths.length];
        }
        this.render()
      },
      selected: function(val) {
        if (val.type === 'OBJECT') {
          this.data.paths.push(val.text);
          this.data.currentFocus.push(0);
          this.verticalNavIndex = this.data.currentFocus[this.data.paths.length];
          this.methods.navigate();
        }
      },
      deleteFileOrFolder: function(current) {
        this.$router.showDialog('Confirm', 'Are sure to delete ' + current.text + ' ?', this.data, 'Yes', () => {
          if (current.type === 'OBJECT') {
            this.$router.showLoading();
            DS.deleteFolder(JSON.parse(JSON.stringify(this.data.paths)), current.text, (taskSuccess, taskFail, length) => {
              this.$router.hideLoading();
              console.log(taskSuccess, taskFail, length);
            }, (taskSuccess, taskFail, length) => {
              console.log(taskSuccess, taskFail, length);
            });
          } else if (current.type === 'FILE' && current.text !== '.index') {
            DS.deleteFile(JSON.parse(JSON.stringify(this.data.paths)), current.text)
            .then((res) => {
              console.log(res)
            })
            .catch((err) => {
              console.log(err)
            });
          }
        }, 'Cancel', undefined);
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
    softKeyText: { left: 'Menu', center: 'OPEN', right: 'Option' },
    softKeyListener: {
      left: function() {
        this.$router.showOptionMenu('Menu', this.data.menu, 'Select', (selected) => {
          if (selected.text === 'Create new folder') {
            this.$router.push(newFolderPage(JSON.parse(JSON.stringify(this.data.paths))));
          } else if (selected.text === 'Kloudless') {
            kloudlessPage(this.$router);
          }
        }, 0);
      },
      center: function() {
        const listNav = document.querySelectorAll(this.verticalNavClass);
        if (this.verticalNavIndex > -1) {
          listNav[this.verticalNavIndex].click();
        }
      },
      right: function() {
        var current = this.data.currentFolderContents[this.data.currentFocus[this.data.paths.length]];
        var options = [];
        if (this.data.copyPath !== '' || this.data.cutPath !== '') {
          options.push({ "text": "Paste into current directory"});
          if (current['type'] === 'OBJECT') {
            options.push({ "text": "Paste into this folder"});
          }
        }
        if (current['type'] === 'FILE') {
          options.push({ "text": "Cut"})
          options.push({ "text": "Copy"})
        }
        options.push({ "text": "Delete"});
        this.$router.showOptionMenu('Option', options, 'Select', (selected) => {
          if (selected.text === 'Copy' || selected.text === 'Cut') {
            var temp = JSON.parse(JSON.stringify(this.data.paths))
            temp.push(current.text);
            this.data.pasteType = current['type'];
            if (selected.text === 'Copy') {
              this.data.cutPath = '';
              this.data.copyPath = temp.join('/');
              console.log('Copy');
            } else if (selected.text === 'Cut') {
              this.data.cutPath = temp.join('/');
              this.data.copyPath = '';
              console.log('Cut');
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
                console.log(taskSuccess, taskFail, length);
              }, (taskSuccess, taskFail, length) => {
                console.log(taskSuccess, taskFail, length);
              }, isCut);
            } else if (this.data.pasteType === 'FILE') {
              DS.copyFile(source, name, to.join('/'), isCut)
              .then((res) => {
                this.data.cutPath = '';
                this.data.copyPath = '';
                this.data.pasteType = '';
                this.$router.showToast(res.target.result);
              })
              .catch((err) => {
                if (err) {
                  this.$router.showToast(err.name);
                } else {
                  this.$router.showToast('Unknown Error');
                }
              });
            }
            //console.log(source, name, to, this.data.pasteType, isCut);
          } else {
            console.log(selected, current, this.data.cutPath !== '', this.data.copyPath !== '');
          }
        }, 0);
      }
    },
    softKeyInputFocusText: { left: 'Copy', center: 'Paste', right: 'Cut' },
    softKeyInputFocusListener: {
      left: function() {
        if (document.activeElement.tagName === 'INPUT') {
          if (document.activeElement.value && document.activeElement.value.length > 0) {
            this.$state.setState('editor', document.activeElement.value);
          }
        }
      },
      center: function() {
        if (document.activeElement.tagName === 'INPUT') {
          document.activeElement.value += this.$state.getState('editor');
        }
      },
      right: function() {
        if (document.activeElement.tagName === 'INPUT') {
          if (document.activeElement.value && document.activeElement.value.length > 0) {
            this.$state.setState('editor', document.activeElement.value);
            document.activeElement.value = '';
          }
        }
      }
    },
    dPadNavListener: {
      arrowUp: function() {
        this.navigateListNav(-1);
        this.data.currentFocus[this.data.paths.length] = this.verticalNavIndex;
      },
      arrowRight: function() {
        // this.navigateTabNav(-1);
      },
      arrowDown: function() {
        this.navigateListNav(1);
        this.data.currentFocus[this.data.paths.length] = this.verticalNavIndex;
      },
      arrowLeft: function() {
        // this.navigateTabNav(1);
      },
    }
  });

  const router = new KaiRouter({
    title: 'File Manager',
    routes: {
      'index' : {
        name: 'mainPage',
        component: mainPage
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
});
