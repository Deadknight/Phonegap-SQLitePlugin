(function() {
  var callbacks, cbref, counter, getOptions, root, background;

  root = this;

  callbacks = {};

  counter = 0;

  cbref = function(hash) {
    var f;
    f = "cb" + (counter += 1);
    callbacks[f] = hash;
    return f;
  };

  getOptions = function(opts, success, error) {
    var cb, has_cbs;
    cb = {};
    has_cbs = false;
    if (typeof success === "function") {
      has_cbs = true;
      cb.success = success;
    }
    if (typeof error === "function") {
      has_cbs = true;
      cb.error = error;
    }
    if (has_cbs) opts.callback = cbref(cb);
    return opts;
  };

  root.PGSQLitePlugin = (function() {

    PGSQLitePlugin.prototype.openDBs = {};

    function PGSQLitePlugin(dbPath, openSuccess, openError, background) {
      this.dbPath = dbPath;
      this.openSuccess = openSuccess;
      this.openError = openError;
      if(background === undefined)
         background = false;
      this.background = background;
      if (!dbPath) {
        throw new Error("Cannot create a PGSQLitePlugin instance without a dbPath");
      }
      this.openSuccess || (this.openSuccess = function() {
        console.log("DB opened: " + dbPath);
      });
      this.openError || (this.openError = function(e) {
        console.log(e.message);
      });
      this.open(this.openSuccess, this.openError);
    }

    PGSQLitePlugin.handleCallback = function(ref, type)
    {
      var argumentsArr = [];
      for(var i = 2; i < arguments.length; i++)
      {
         argumentsArr.push(arguments[i]);
      }
      
      var _ref;
      if ((_ref = callbacks[ref]) != null) {
        if (typeof _ref[type] === "function") _ref[type].apply(this, argumentsArr);
      }
      callbacks[ref] = null;
      delete callbacks[ref];
    };

    PGSQLitePlugin.prototype.executeSql = function(sql) {
      var success, error;
      if(arguments.length == 4)
      {
          success = arguments[2];
          error = arguments[3];
      }
      else
      {
          success = arguments[1];
          error = arguments[2];
      }
      var opts;
      if (!sql) throw new Error("Cannot executeSql without a query");
      opts = getOptions({
        query: [].concat(sql || []),
        path: this.dbPath
      }, success, error);
    if(background)
      Cordova.exec("PGSQLitePlugin.backgroundExecuteSql", opts);
    else
      Cordova.exec("PGSQLitePlugin.executeSql", opts);
    };

    PGSQLitePlugin.prototype.transaction = function(fn, success, error) {
      var t;
      t = new root.PGSQLitePluginTransaction(this.dbPath);
      fn(t);
      return t.complete(success, error);
    };

    PGSQLitePlugin.prototype.open = function(success, error) {
      var opts;
      if (!(this.dbPath in this.openDBs)) {
        this.openDBs[this.dbPath] = true;
        opts = getOptions({
          path: this.dbPath
        }, success, error);
        Cordova.exec("PGSQLitePlugin.open", opts);
      }
    };

    PGSQLitePlugin.prototype.close = function(success, error) {
      var opts;
      if (this.dbPath in this.openDBs) {
        delete this.openDBs[this.dbPath];
        opts = getOptions({
          path: this.dbPath
        }, success, error);
        Cordova.exec("PGSQLitePlugin.close", opts);
      }
    };

    return PGSQLitePlugin;

  })();

  root.PGSQLitePluginTransaction = (function() {

    function PGSQLitePluginTransaction(dbPath) {
      this.dbPath = dbPath;
      this.executes = [];
    }

    PGSQLitePluginTransaction.prototype.executeSql = function(sql){
      var success, error;
      if(arguments.length == 4)
      {
          success = arguments[2];
          error = arguments[3];
      }
      else
      {
          success = arguments[1];
          error = arguments[2];
      }
      this.executes.push(getOptions({
        query: [].concat(sql || []),
        path: this.dbPath
      }, success, error));
    };

    PGSQLitePluginTransaction.prototype.complete = function(success, error) {
      var begin_opts, commit_opts, executes, opts;
      if (this.__completed) throw new Error("Transaction already run");
      this.__completed = true;
      begin_opts = getOptions({
        query: ["BEGIN;"],
        path: this.dbPath
      });
      commit_opts = getOptions({
        query: ["COMMIT;"],
        path: this.dbPath
      }, success, error);
      executes = [begin_opts].concat(this.executes).concat([commit_opts]);
      opts = {
        executes: executes
      };
    if(background)
      Cordova.exec("PGSQLitePlugin.backgroundExecuteSqlBatch", opts);
    else
      Cordova.exec("PGSQlitePlugin.executeSqlBatch", opts);
      this.executes = [];
    };

    return PGSQLitePluginTransaction;

  })();

}).call(this);