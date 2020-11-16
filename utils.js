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
