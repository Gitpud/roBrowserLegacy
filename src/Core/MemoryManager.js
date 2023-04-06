/**
 * Core/MemoryManager.js
 *
 * Memory Manager
 *
 * Set up a cache context to avoid re-loading/parsing files each time, files are removed automatically if not used
 *
 * This file is part of ROBrowser, (http://www.robrowser.com/).
 *
 * @author Vincent Thibault
 */

define(['Core/MemoryItem'], function(MemoryItem) {
    'use strict';
  
    /**
     * List of files in memory
     * @var Map MemoryItem
     */
    var _memory = new Map();
  
    /**
     * Remove files from memory if not used until a period of time
     * @var {number}
     */
    var _rememberTime = 2 * 60 * 1000; // 2 min
  
    /**
     * @var {number} last time we clean up variables
     */
    var _lastCheckTick = 0;
  
    /**
     * @var {number} perform the clean up every 30 secs
     */
    var _cleanUpInterval = 30 * 1000;
  
    /**
     * Map to store last access time for each item
     * @var Map
     */
    var _lastAccessTime = new Map();
  
    /**
     * Get back data from memory
     *
     * @param {string} filename
     * @param {function} onload - optional
     * @param {function} onerror - optional
     * @return mixed data
     */
    function get(filename, onload, onerror) {
      var item = _memory.get(filename);
  
      // Not in memory yet, create slot
      if (!item) {
        item = new MemoryItem();
        _memory.set(filename, item);
      }
  
      if (onload) {
        item.addEventListener('load', onload);
      }
  
      if (onerror) {
        item.addEventListener('error', onerror);
      }
  
      return item.data;
    }
  
    /**
     * Check if the entry exists
     *
     * @param {string} filename
     * @return boolean isInMemory
     */
    function exist(filename) {
      return _memory.has(filename);
    }
  
    /**
     * Stored data in memory
     *
     * @param {string} filename
     * @param {string|object} data
     * @param {string} error - optional
     */
    function set(filename, data, error) {
      // Not in memory yet, create slot
      var item = _memory.get(filename);
      if (!item) {
        item = new MemoryItem();
        _memory.set(filename, item);
      }
  
      var hasError = error || !data;
      item[hasError ? 'onerror' : 'onload'](data);
    }
  
  /**
   * Clean up not used data from memory
   *
   * @param {object} gl - WebGL Context
   * @param {number} now - game tick
   */
  function clean(gl, now) {
    if (_lastCheckTick + _cleanUpInterval > now) {
      return;
    }

    var tick = now - _rememberTime;

    for (var [filename, item] of _memory) {
      if (item.complete && _lastAccessTime.get(filename) < tick) {
        remove(gl, filename);
      }
    }

    _lastCheckTick = now;
  }

  /**
   * Remove Item from memory
   *
   * @param {object} gl - WebGL Context
   * @param {string} filename
   */
  function remove(gl, filename) {
    // Not found ?
    if (!_memory.has(filename)) {
      return;
    }

    var item = _memory.get(filename);
    var file = item.data;

    var ext = filename.match(/\.[^\.]+$/)?.toString().toLowerCase() || '';

    // Free file
    if (file) {
      switch (ext) {
        // Delete GPU textures from sprites
        case '.spr':
          if (file.frames) {
            for (var i = 0, count = file.frames.length; i < count; ++i) {
              if (file.frames[i].texture && gl.isTexture(file.frames[i].texture)) {
                gl.deleteTexture(file.frames[i].texture);
              }
            }
          }
          if (file.texture && gl.isTexture(file.texture)) {
            gl.deleteTexture(file.texture);
          }
          break;

        // Delete palette
        case '.pal':
          if (file.texture && gl.isTexture(file.texture)) {
            gl.deleteTexture(file.texture);
          }
          break;

        // If file is a blob, remove it (wav, mp3, lua, lub, txt, ...)
        default:
          if (file.match?.(/^blob\:/)) {
            URL.revokeObjectURL(file);
          }
          break;
      }
    }

    // Delete from memory
    _memory.delete(filename);
    _lastAccessTime.delete(filename);
  }

  /**
   * Search files in memory based on a regex
   *
   * @param regex
   * @return string[] filename
   */
  function search(regex) {
    var out = [];

    for (var [filename, item] of _memory) {
      if (filename.match(regex)) {
        out.push(filename);
      }
    }

    return out;
  }

  /**
   * Update last access time for a file
   *
   * @param {string} filename
   * @param {number} time
   */
  function updateAccessTime(filename, time) {
    _lastAccessTime.set(filename, time);
  }

  /**
   * Export methods
   */
  return {
    get: get,
    set: set,
    clean: clean,
    remove: remove,
    exist: exist,
    search: search,
    updateAccessTime: updateAccessTime,
  };
});
