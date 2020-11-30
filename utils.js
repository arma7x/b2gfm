var Iterator = (function () {

  function Iterator(arr) {
    this.items = arr;
    this.index = 0;
  }

  Iterator.prototype.next = function () {
    if (this.hasNext() ) {
      return this.items[this.index++];
    } else {
      return null;
    }
  }

  Iterator.prototype.hasNext = function () {
    if (this.index < this.items.length ) {
      return true;
    } else {
      return false;
    }
  }

  return Iterator;
})();


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
