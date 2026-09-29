/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Weave: false, Event: false, Form: false */
/**
 * The Activator manage the dispatch of incoming launch commands.
 * 'Interfaces' (literals of functions) are attached to the Activator
 * together with the interface name and the target stage.  Then a command
 * is 'run', the format of the arguments is used to locate the relevant interface,
 * launch the stage if necessary, and dispatch the contains arguments to the
 * methods named in the parameters.  The command format is:
 *   { interfacename: { methodname: { ... arguments .... } }
 * If no parameters are present, then the 'main' interface is called.  If the
 * stage is created, it calls the 'start' method, if not it calls the 'restart'
 * method.
 
Copyright 2009 Palm, Inc.  All rights reserved.

*/
Weave.System.Activator = 
{	
	_inames: {},
	_snames: {},
	
	addInterface: function(args, iface)
	{
		var config = { name: 'default', stagename: 'default', iface: iface };
		if (Object.isString(args)) 
		{
			config.name = args;
		}
		else 
		{
			Object.extend(config, args);
		}
		this._inames[config.name] = config;
	},
	
	removeInterface: function(name)
	{
		delete this._inames[name];
	},
	
	addIndex: function(stagename, index)
	{
		this._snames[stagename] = index;
	},
	
	removeIndex: function(stagename)
	{
		delete this._snames[stagename];
	},
	
	run: function(params)
	{
		if (params) 
		{
			for (var k in params) 
			{
				var iface = this._inames[k];
				if (iface) 
				{
					for (var m in params[k]) 
					{
						if (iface.iface[m]) 
						{
							this.open(iface.stagename, function(stage)
							{
								iface.iface[m](params[k][m], stage);
							});
							return true;
						}
						break;
					}
				}
				break;
			}
		}
		var iface = this._inames.main;
		if (iface) 
		{
			this.open(iface.stagename, function(stage, isnew)
			{
				if (!isnew && iface.iface.restart)
				{
					iface.iface.restart(stage);
					return true;
				}
				else if (iface.iface.start)
				{
					iface.iface.start(stage);
					return true;
				}
			});
		}
		return false;
	},
	
	open: function(name, callback)
	{
		if (name == null) 
		{
			callback && callback(null, false);
		}
		else 
		{
			var stage = Mojo.Controller.appController.getStageController(name);
			if (stage) 
			{
				callback && callback(stage.assistant, false);
			}
			else 
			{
				var self = this;
				Mojo.Controller.appController.createStageWithCallback(
				{
					lightweight: true,
					name: name,
					assistantName: name.charAt(0).toUpperCase() + name.substring(1) + 'StageAssistant',
					htmlFileName: this._snames[name],
				}, function(stage)
				{
					callback && callback(stage.assistant, true);
				}, (name == 'dashboard' ? 'dashboard' : undefined));
			}
		}
	},
	
	close: function(name)
	{
		Mojo.Controller.appController.closeStage(name);
	},
};
