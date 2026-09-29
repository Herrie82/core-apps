/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Template: false, Event: false, Form: false */

/**
 * Extend the framework in useful, but application specific, ways.
 
Copyright 2009 Palm, Inc.  All rights reserved.

*/

/**
 * Don't use the mojo function/closure bridge because it just slows things down for
 * no terribly good reason.
 * Also, it makes extending the other parts of the framework easier.
 */
/*
Mojo.Controller.WidgetController = Class.create(Mojo.Controller.WidgetController,
{
	exposeMethods: function()
	{
		this.element.mojo = this.assistant;
	},
});
*/
/* Patch the specific methods to avoid loosing WidgetDispose */


Mojo.Controller.WidgetController.prototype.exposeMethods = function() { this.element.mojo = this.assistant; };

/**
 * Override the Mojo.Widget.List with a number of helpful methods to allow us to do things
 * simpler and faster than provided by the default methods.  This doesn't mean the old methods
 * are bad, only that they do a lot of stuff we don't need to, and so we simply avoid it.
 */

console.error("*&*&*&*&*&*&*&*&*&*&*&*&* Patching indexed list " + Mojo.Widget.IndexedList);
Mojo.Widget.IndexedList.subclasses = [];

Mojo.Widget.IndexedList = Class.create(Mojo.Widget.IndexedList,
{
	reloadAll: function()
	{
		this.bigItemsList.requestFullWindow();
	},
	
	/**
	 * Update a set of items in the list at a given offset, and also set the total
	 * list length at the same time.  We do this carefully in an attempt to stop the
	 * list from asking for more data (if we extend the list length too soon) and
	 * try to avoid it rerendering unnecessarily (by truncating the list before
	 * updating models - we also specifically block render calls at various points).
	 * 
	 * @param {Object} offset
	 * @param {Object} items
	 * @param {Object} total
	 */
	updateItemsAndTotalLength: function(offset, items, total)
	{
		var clen = this.getLength();
//		Mojo.Log.info("updateItemsAndTotalLength %d %d %j %d", offset, items, total, clen);
		if (total < clen) 
		{
/*
			// Remove the elements after the new list-end
			this._removeListNodesBetween(this.getNodeByIndex(total) || this.topSpacer, this.bottomSpacer);
			// Prevent updates while we're setting the length since they're pointless
			this.renderFromModel = Mojo.doNothing;
			this.setLength(total);
			delete this.renderFromModel;			
			clen = total;
*/
			this.setLength(total);
			clen = total;
		}
		if (clen == offset) 
		{
			this.noticeAddedItems(offset, items);
			clen += items.length;
		}
		else 
		{
			this.noticeUpdatedItems(offset, items);
			clen = Math.max(clen, offset + items.length);
		}
		if (total > clen) 
		{
			this.setLength(total);
		}
	},
	
	/**
	 * Insert a set of models at a specific offset.
	 * This is what 'noticeAddedItems' done, but here we avoid
	 * rebuilding the entire list DOM since it isn't effected by
	 * the insertion in any material way.
	 * 
	 * NOTE: I really would like to do this the fast way, but there are too
	 * many corner cases for long lists causing bad rendering - and for the moment
	 * at least I want it to work more than I want it to be fast
	 * 
	 * @param {Object} offset
	 * @param {Object} items
	 */
	insertItemsAt: function(offset, items)
	{
/****
		Mojo.Log.info("insertItemsAt: %d %j", offset, items);
		// We can optimize if the list is intialized
		if (this.listItemsParent) 
		{
			var after = this.getNodeByIndex(offset);
			if (after) 
			{
				Mojo.Log.info("Fast way");
				var before = after.previousSibling;
				this.renderFromModel = Mojo.doNothing;
				this.noticeAddedItems(offset, items);
				delete this.renderFromModel;
				this.renumberListItems = Mojo.doNothing;
				this.renderItemsBefore(items, after);
				delete this.renumberListItems;
				this._renumberListItemsBetween(before, this.bottomSpacer);
				return;
			}
		}
		Mojo.Log.info("Slow way");
		// Otherwise we do it the slow way
****/
		this.noticeAddedItems(offset, items);
	},
	
	/**
	 * Provide a fast way to find the index of an item .
	 * 
	 */
	getItemIndexByProperty: function(value, property)
	{
		var items = this.bigItemsList._items;
		var len = items.length;
		for (var i = 0; i < len; i++)
		{
			var item = items[i];
			if (item && item[property] == value)
			{
				return i + this.bigItemsList._windowOffset;
			}
		}
		return undefined;
	},
	
	getModels: function()
	{
		return this.bigItemsList._items;
	},
	
	rerenderAll: function()
	{
		this.updateListItems();
	},
	
	updateListClasses: function()
	{
		// No class annotations
	},
	
	_maybeRemeasureChildWidgets: function()
	{
		// No remeasuring
	},

	_renumberListItemsBetween: function(start, end)
	{
		var idx = start._mojoListIndex !== undefined ? start._mojoListIndex : -1;
		for (var node = start.nextSibling; node != end; node = node.nextSibling)
		{
			idx++;
			var cidx = node._mojoListIndex;
			if (cidx != idx)
			{
				node._mojoListIndex = idx;
			}
		}
	},
	
	_removeListNodesBetween: function(node, end)
	{
		var parent = node.parentNode;
        while (node != end) 
		{
        	var newNode = node.nextSibling;
			parent.removeChild(node);
            node = newNode;
        }
	},
	
	holdHandler: function($super, event)
	{
		if (this.controller.attributes.reorderable) 
		{
			$super(event);
		}
	},
});

console.info("Done patching indexed list " + Mojo.Widget.IndexedList);

