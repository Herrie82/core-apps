/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false*/

/* Copyright 2009 Palm, Inc.  All rights reserved. */

Weave.Utilities.AppMenu = Class.create(
{
	initialize: function(scene, inherit)
	{
		this._scene = scene;
		this._items = inherit ? inherit._items : [];
		this._mitems = inherit ? inherit._mitems : [];
		if (scene) 
		{
			this._oldHandleCommand = scene.handleCommand;
			scene.handleCommand = this._handleCommand.bind(this);
			if (scene.controller.setupWidget) 
			{
				this.model = { items: this._mitems };
				scene.controller.setupWidget(Mojo.Menu.appMenu, 
				{
					omitDefaultItems: true,
				}, 
				this.model);
			}
		}
	},
	
	addItem: function(label, callback, enabled)
	{
		var item = { label: label, command: 'cmd' + this._items.length + 1, checkEnabled: (enabled ? true : false), _callback: callback, _enabled: enabled };
		this._items.push(item);
		this._mitems.push(item);
		return this;
	},
	
	addEdit: function()
	{
		this._items.push(Mojo.Menu.editItem);
		this._mitems.push(Mojo.Menu.editItem);
		return this;
	},
	
	addHelp: function(url, enabled)
	{
		if (url) 
		{
			var item = Object.extend(
			{
				_callback: function()
				{
					Weave.Services.ApplicationManager.openApplication('com.palm.app.help', 
					{
						target: url
					});
				},
				_enabled: enabled ? enabled : function(event)
				{
					event.stopPropagation();
					return true;
				}
			}, Mojo.Menu.helpItem);
			this._items.push(item);
			this._mitems.push(item);
		}
		else
		{
			this._items.push(Mojo.Menu.helpItem);
			this._mitems.push(Mojo.Menu.helpItem);
		}
		return this;
	},
	
	addPreferences: function(callback, enabled)
	{
		if (callback) 
		{
			var item = Object.extend(
			{
				_callback: callback,
				_enabled: enabled ? enabled : function(event)
				{
					event.stopPropagation();
					return true;
				}
			}, Mojo.Menu.prefsItem);
			this._items.push(item);
			this._mitems.push(item);
		}
		else
		{
			this._items.push(Mojo.menu.prefsItem);
			this._mitems.push(Mojo.menu.prefsItem);
		}
		return this;
	},
	
	addSubMenu: function(label)
	{
		var submenu = new Weave.Utilities.AppMenu();
		submenu._parent = this;
		submenu._items = this._items;
		this._mitems.push({ label: label, items: submenu._mitems });
		return submenu;
	},
	
	popSubMenu: function()
	{
		return this._parent;
	},
	
	_handleCommand: function(event)
	{
		if (event.type == Mojo.Event.commandEnable)
		{
			for (var i = 0; i < this._items.length; i++)
			{
				if (this._items[i].command == event.command)
				{
					if (this._items[i]._enabled && !this._items[i]._enabled(event)) 
					{
						event.stopPropagation();
						event.preventDefault();
					}
					break;
				}
			}
		}
		else if (event.type == Mojo.Event.command)
		{
			for (var i = 0; i < this._items.length; i++)
			{
				if (this._items[i].command == event.command)
				{
					this._items[i]._callback && this._items[i]._callback(event, this._items[i]);
					break;
				}
			}
		}
		this._oldHandleCommand && this._oldHandleCommand.call(this._scene, event);
	},
	
});

Object.extend(Weave.Utilities.AppMenu,
{
	setDefault: function(menu)
	{
		Weave.Utilities.AppMenu.defaultMenu = menu;
	},
	
	useDefault: function(scene)
	{
		new Weave.Utilities.AppMenu(scene, Weave.Utilities.AppMenu.defaultMenu);
	}
});
