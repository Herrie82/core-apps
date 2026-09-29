/*jslint laxbreak: true, white: false, devel: true */
/*global Class: false, Mojo: false, $L: false, Weave: false, Event: false, Form: false */
/**
 * Services provides a basic garbage-collector safe wrapper round the standard service 
 * requests.
 
Copyright 2009 Palm, Inc.  All rights reserved.

*/
Object.extend(Weave.Services,
{	
	_pending: {},
	_next: 1,

	request: function(target, args, success, failure)
	{
		var id = this._next++;
		var pending = this._pending;
		args.onSuccess = function(response)
		{
			delete pending[id];
Mojo.Log.info("\n\n||||||||||WEAVE RESPONSE|||||||||| response:" + JSON.stringify(response));	
			success && success(response);
		};
		args.onFailure = function(response)
		{
			delete pending[id];
			failure && failure(response);
		};
		
		
if (args.method){
		Mojo.Log.info("\n\n||||||||||WEAVE TARGETMETHOD|||||||||| targetMethod: "+ args.method);
}
Mojo.Log.info("\n\n||||||||||WEAVE ARGS,TARGET|||||||||| target: " + JSON.stringify(target) + " || args: " + JSON.stringify(args));
		
		if (target != "palm://com.palm.tasks") {
			pending[id] = new Mojo.Service.Request(target, args);
		}else {
			pending[id] = db[args.method](args.parameters, args.onSuccess, args.onFailure, args.subscribe);
		}
		return pending[id];
	}
	
});
