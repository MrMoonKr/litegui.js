
/**
* Core namespace of LiteGUI library, it holds some useful functions
*
* @class LiteGUI
* @constructor
*/


var LiteGUI = {
	root: null,
	content: null,

	panels: {},
	windows: [], //windows opened by the GUI (we need to know about them to close them once the app closes)

	//undo
	undo_steps: [],

	//used for blacken when a modal dialog is shown
	modalbg_div: null,

	//the top menu
	mainmenu: null,

	/**
	* initializes the lib, must be called
	* @method init
	* @param {object} options some options are container, menubar, 
	*/
	init: function(options)
	{
		options = options || {};

		if(options.width && options.height)
			this.setWindowSize(options.width,options.height);

		//choose main container
		this.container = null;
		if( options.container )
			this.container = document.getElementById(options.container);
		if(!this.container )
			this.container = document.body;

		//create litegui root element
		var root = document.createElement("div");
		root.className = "litegui-wrap fullscreen";
		root.style.position = "relative";
		root.style.overflow = "hidden";
		this.root = root;
		this.container.appendChild( root );

		//create modal dialogs container
		var modalbg = this.modalbg_div = document.createElement("div");
		this.modalbg_div.className = "litemodalbg";
		this.root.appendChild(this.modalbg_div);
		modalbg.style.display = "none";

		//content: the main container for everything
		var content = document.createElement("div");
		content.className = "litegui-maincontent";
		this.content = content;
		this.root.appendChild(content);

		//create menubar
		if(options.menubar)
			this.createMenubar();

		//called before anything
		if(options.gui_callback)
			options.gui_callback();

		//maximize
		if( this.root.classList.contains("fullscreen") )
		{
			window.addEventListener("resize", function(e) { 
				LiteGUI.maximizeWindow();
			});
		}

		window.addEventListener("beforeunload", function(e) {
			for(var i in LiteGUI.windows)
				LiteGUI.windows[i].close();
			LiteGUI.windows = [];
		});
	},

	/**
	* Triggers a simple event in an object (similar to jQuery.trigger)
	* @method trigger
	* @param {Object} element could be an HTMLEntity or a regular object
	* @param {Object} element could be an HTMLEntity or a regular object
	* @param {Object} element could be an HTMLEntity or a regular object
	*/
	trigger: function(element, event_name, params)
	{
		var evt = document.createEvent( 'CustomEvent' );
		evt.initCustomEvent( event_name, true,true, params ); //canBubble, cancelable, detail
		if( element.dispatchEvent )
			element.dispatchEvent( evt );
		else if( element.__events )
			element.__events.dispatchEvent( evt );
		//else nothing seems binded here so nothing to do
		return evt;
	},

	/**
	* Binds an event in an object (similar to jQuery.bind)
	* If the element is not an HTML entity a new one is created, attached to the object (as non-enumerable, called __events) and used
	* @method trigger
	* @param {Object} element could be an HTMLEntity or a regular object
	* @param {String} event the string defining the event
	* @param {Function} callback where to call
	*/
	bind: function( element, event, callback )
	{
		if(!callback)
			throw("bind callback missing");
		if(element.addEventListener)
			element.addEventListener(event, callback);
		else if(element.__events)
			element.__events.addEventListener( event, callback );
		else
		{
			//create a dummy HTMLentity so we can use it to bind HTML events
			var dummy = document.createElement("span");
			dummy.widget = element; //double link
			Object.defineProperty( element, "__events", {
				enumerable: false,
				configurable: false,
				writable: false,
				value: dummy
			});

			element.__events.addEventListener( event, callback );
		}
	},

	/**
	* Unbinds an event in an object (similar to jQuery.unbind)
	* @method unbind
	* @param {Object} element could be an HTMLEntity or a regular object
	* @param {String} event the string defining the event
	* @param {Function} callback where to call
	*/
	unbind: function(element, event, callback)
	{
		if( element.removeEventListener )
			element.removeEventListener( event, callback );
		else if( element.__events && element.__events.removeEventListener )
			element.__events.removeEventListener( event, callback );
	},

	/**
	* Appends litegui widget to the global interface
	* @method add
	* @param {Object} litegui_element
	*/
	add: function( litegui_element )
	{
		this.content.appendChild( litegui_element.root || litegui_element );
	},

	/**
	* Remove from the interface, it is is an HTML element it is removed from its parent, if it is a widget the same.
	* @method remove
	* @param {Object} litegui_element it also supports HTMLentity or selector string
	*/
	remove: function( element )
	{
		if(element && element.constructor === String) //selector
		{
			var elements = document.querySelectorAll( element );
			for(var i = 0; i < elements.length; ++i)
			{
				var element = elements[i];
				if(element && element.parentNode)
					element.parentNode.removeChild(element);
			}
		}
		else if( element.root && element.root.parentNode ) //ltiegui widget
			element.root.parentNode.removeChild( element.root );
		else if( element.parentNode ) //regular HTML entity
			element.parentNode.removeChild( element );
	},

	/**
	* wrapper of document.getElementById
	* @method getById
	* @param {String} id
	* return {HTMLEntity}
	**/
	getById: function(id)
	{
		return document.getElementById(id);
	},

	createMenubar: function()
	{
		this.menubar = new LiteGUI.Menubar("mainmenubar");
		this.add( this.menubar );
	},

	setWindowSize: function(w,h)
	{
		if(w && h)
		{
			$(this.root).css( {width: w+"px", height: h + "px", "box-shadow":"0 0 4px black"}).removeClass("fullscreen");

		}
		else
		{
			if( $(this.root).hasClass("fullscreen") )
				return;
			$(this.root).addClass("fullscreen");
			$(this.root).css( {width: "100%", height: "100%", "box-shadow":"0 0 0"});
		}
		$(LiteGUI).trigger("resized");
	},

	maximizeWindow: function()
	{
		this.setWindowSize();
	},

	/**
	* Change cursor
	* @method setCursor
	* @param {String} cursor
	**/
	setCursor: function( name )
	{
		this.root.style.cursor = name;
	},

	/**
	* Copy a string to the clipboard (it needs to be invoqued from a click event)
	* @method toClipboard
	* @param {String} data
	**/
	toClipboard: function( object )
	{
		if(object && object.constructor !== String )
			object = JSON.stringify( object );

		var input = null;
		var in_clipboard = false;
		try
		{
			var copySupported = document.queryCommandSupported('copy');
			input = document.createElement("input");
			input.type = "text";
			input.style.opacity = 0;
			input.value = object;
			document.body.appendChild( input );
			input.select();
			in_clipboard = document.execCommand('copy');
			console.log( in_clipboard ? "saved to clipboard" : "problem saving to clipboard");
			document.body.removeChild( input );
		} catch (err) {
			if(input)
				document.body.removeChild( input );
			console.log('Oops, unable to copy using the true clipboard');
		}

		//old system
		localStorage.setItem("litegui_clipboard", object );
	},

	/**
	* Reads from the secondary clipboard (only can read if the data was stored using the toClipboard)
	* @method getClipboard
	* @return {String} clipboard
	**/
	getClipboard: function()
	{
		var data = localStorage.getItem("litegui_clipboard");
		if(!data) 
			return null;
		if(data[0] == "{")
			return JSON.parse( data );
		return data;
	},

	/**
	* Insert some CSS code to the website
	* @method addCSS
	* @param {String|Object} code it could be a string with CSS rules, or an object with the style syntax.
	**/
	addCSS: function(code)
	{
		if(!code)
			return;

		if(code.constructor === String)
		{
			var style = document.createElement('style');
			style.type = 'text/css';
			style.innerHTML = code;
			document.getElementsByTagName('head')[0].appendChild(style);
			return;
		}
		else
		{
			for(var i in code)
			document.body.style[i] = code[i];
		}
	},

	/**
	* Requires a new CSS
	* @method requireCSS
	* @param {String} url string with url or an array with several urls
	* @param {Function} on_complete
	**/
	requireCSS: function(url, on_complete)
	{
		if(typeof(url)=="string")
			url = [url];

		while(url.length)
		{
			var link  = document.createElement('link');
			//link.id   = cssId;
			link.rel  = 'stylesheet';
			link.type = 'text/css';
			link.href = url.shift(1);
			link.media = 'all';
			var head = document.getElementsByTagName('head')[0];
			head.appendChild(link);
			if(url.length == 0)
				link.onload = on_complete;
		}
	},

	/**
	* Request file from url (it could be a binary, text, etc.). If you want a simplied version use 
	* @method request
	* @param {Object} request object with all the parameters like data (for sending forms), dataType, success, error
	* @param {Function} on_complete
	**/
	request: function(request)
	{
		var dataType = request.dataType || "text";
		if(dataType == "json") //parse it locally
			dataType = "text";
		else if(dataType == "xml") //parse it locally
			dataType = "text";
		else if (dataType == "binary")
		{
			//request.mimeType = "text/plain; charset=x-user-defined";
			dataType = "arraybuffer";
			request.mimeType = "application/octet-stream";
		}	

		//regular case, use AJAX call
        var xhr = new XMLHttpRequest();
        xhr.open(request.data ? 'POST' : 'GET', request.url, true);
        if(dataType)
            xhr.responseType = dataType;
        if (request.mimeType)
            xhr.overrideMimeType( request.mimeType );
        xhr.onload = function(load)
		{
			var response = this.response;
			if(this.status != 200)
			{
				var err = "Error " + this.status;
				if(request.error)
					request.error(err);
				LEvent.trigger(xhr,"fail", this.status);
				return;
			}

			if(request.dataType == "json") //chrome doesnt support json format
			{
				try
				{
					response = JSON.parse(response);
				}
				catch (err)
				{
					if(request.error)
						request.error(err);
					else
						throw err;
				}
			}
			else if(request.dataType == "xml")
			{
				try
				{
					var xmlparser = new DOMParser();
					response = xmlparser.parseFromString(response,"text/xml");
				}
				catch (err)
				{
					if(request.error)
						request.error(err);
					else
						throw err;
				}
			}
			if(request.success)
				request.success.call(this, response, this);
		};
        xhr.onerror = function(err) {
			if(request.error)
				request.error(err);
		}
        xhr.send(request.data);
		return xhr;
	},	

	/**
	* Request file from url
	* @method requestText
	* @param {String} url
	* @param {Function} on_complete
	* @param {Function} on_error
	**/
	requestText: function(url, on_complete, on_error )
	{
		return this.request({ url: url, dataType:"text", success: on_complete, error: on_error });
	},

	/**
	* Request file from url
	* @method requestJSON
	* @param {String} url
	* @param {Function} on_complete
	* @param {Function} on_error
	**/
	requestJSON: function(url, on_complete, on_error )
	{
		return this.request({ url: url, dataType:"json", success: on_complete, error: on_error });
	},

	/**
	* Request binary file from url
	* @method requestBinary
	* @param {String} url
	* @param {Function} on_complete
	* @param {Function} on_error
	**/
	requestBinary: function(url, on_complete, on_error )
	{
		return this.request({ url: url, dataType:"binary", success: on_complete, error: on_error });
	},
	
	
	/**
	* Request script and inserts it in the DOM
	* @method requireScript
	* @param {String} url
	* @param {Function} on_complete
	* @param {Function} on_error
	* @param {Function} on_progress (if several files are required, on_progress is called after every file is added to the DOM)
	**/
	requireScript: function(url, on_complete, on_error, on_progress )
	{
		if(!url)
			throw("invalid URL");

		if( url.constructor === String )
			url = [url];

		var total = url.length;
		var size = total;

		for(var i in url)
		{
			var script = document.createElement('script');
			script.num = i;
			script.type = 'text/javascript';
			script.src = url[i];
			script.async = false;
			script.onload = function(e) { 
				total--;
				if(total)
				{
					if(on_progress)
						on_progress(this.src, this.num);
				}
				else if(on_complete)
					on_complete();
			};
			if(on_error)
				script.onerror = function(err) { 
					on_error(err, this.src, this.num );
				}
			document.getElementsByTagName('head')[0].appendChild(script);
		}
	},


	//old version, it loads one by one, so it is slower
	requireScriptSerial: function(url, on_complete, on_progress )
	{
		if(typeof(url)=="string")
			url = [url];

		function addScript()
		{
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = url.shift(1);
			script.onload = function(e) { 
				if(url.length)
				{
					if(on_progress)
						on_progress(url[0], url.length);

					addScript();
					return;
				}
				
				if(on_complete)
					on_complete();
			};
			document.getElementsByTagName('head')[0].appendChild(script);
		}

		addScript();
	},

	newDiv: function(id, code)
	{
		return this.createElement("div",id,code);
	},

	/**
	* Request script and inserts it in the DOM
	* @method createElement
	* @param {String} tag
	* @param {String} id_class string containing id and classes, example: "myid .someclass .anotherclass"
	* @param {String} content
	* @param {Object} style
	**/
	createElement: function(tag, id_class, content, style, events)
	{
		var elem = document.createElement( tag );
		if(id_class)
		{
			var t = id_class.split(" ");
			for(var i = 0; i < t.length; i++)
			{
				if(t[i][0] == ".")
					elem.classList.add( t[i].substr(1) );
				else if(t[i][0] == "#")
					elem.id = t[i].substr(1);
				else
					elem.id = t[i];
			}
		}
		elem.root = elem;
		if(content)
			elem.innerHTML = content;
		elem.add = function(v) { this.appendChild( v.root || v ); };

		if(style)
		{
			if(style.constructor === String)
				elem.setAttribute("style",style);
			else
				for(var i in style)
					elem.style[i] = style[i];
		}

		if(events)
		{
			for(var i in events)
				elem.addEventListener(i, events[i]);
		}
		return elem;
	},

	/**
	* Request script and inserts it in the DOM
	* @method createButton
	* @param {String} id
	* @param {String} content
	* @param {Function} callback when the button is pressed
	**/
	createButton: function( id, content, callback )
	{
		var elem = document.createElement("button");
		elem.id = id;
		elem.root = elem;
		elem.className = "litegui button";
		if(content !== undefined)
			elem.innerHTML = content;
		if(callback)
			elem.addEventListener("click", callback );
		return elem;
	},

	//used to create a window that retains all the CSS info or the scripts.
	newWindow: function(title, width, height, options)
	{
		options = options || {};
		var new_window = window.open("","","width="+width+", height="+height+", location=no, status=no, menubar=no, titlebar=no, fullscreen=yes");
		new_window.document.write( "<html><head><title>"+title+"</title>" );

		//transfer style
		var styles = document.querySelectorAll("link[rel='stylesheet'],style");
		for(var i = 0; i < styles.length; i++)
			new_window.document.write( styles[i].outerHTML );

		//transfer scripts (optional because it can produce some errors)
		if(options.scripts)
		{
			var scripts = document.querySelectorAll("script");
			for(var i = 0; i < scripts.length; i++)
			{
				if(scripts[i].src) //avoid inline scripts, otherwise a cloned website would be created
					new_window.document.write( scripts[i].outerHTML );
			}
		}


		var content = options.content || "";
		new_window.document.write( "</head><body>"+content+"</body></html>" );
		new_window.document.close();
		return new_window;
	},

	//* DIALOGS *******************
	showModalBackground: function(v)
	{
		LiteGUI.modalbg_div.style.display = v ? "block" : "none";
	},

	showMessage: function(content, options)
	{
		options = options || {};
		
		options.title = options.title || "Attention";
		options.content = content;
		options.close = 'fade';
		var dialog = new LiteGUI.Dialog(null,options);
		if(!options.noclose)
			dialog.addButton("Close",{ close: true });
		dialog.makeModal('fade');
		return dialog;
	},

	/**
	* Shows a dialog with a message
	* @method popup
	* @param {String} content
	* @param {Object} options ( min_height, content, noclose )
	**/
	popup: function( content, options )
	{
		options = options || {};

		options.min_height = 140;
		if (typeof(content) == "string")
			content = "<p>" + content + "</p>";

		options.content = content;
		options.close = 'fade';

		var dialog = new LiteGUI.Dialog("info_message",options);
		if(!options.noclose)
			dialog.addButton("Close",{ close: true });
		dialog.show();
		return dialog;
	},


	/**
	* Shows an alert dialog with a message
	* @method alert
	* @param {String} content
	* @param {Object} options ( title, width, height, content, noclose )
	**/
	alert: function( content, options )
	{
		options = options || {};

		
		options.className = "alert";
		options.title = options.title || "Alert";
		options.width = options.width || 280;
		options.height = options.height || 140;
		if (typeof(content) == "string")
			content = "<p>" + content + "</p>";
		$(".litepanel.alert").remove(); //kill other panels
		return LiteGUI.showMessage(content,options);
	},

	/**
	* Shows a confirm dialog with a message
	* @method confirm
	* @param {String} content
	* @param {Function} callback
	* @param {Object} options ( title, width, height, content, noclose )
	**/
	confirm: function(content, callback, options)
	{
		options = options || {};
		options.className = "alert";
		options.title = options.title || "Confirm";
		options.width = options.width || 280;
		//options.height = 100;
		if (typeof(content) == "string")
			content = "<p>" + content + "</p>";

		content +="<button data-value='yes' style='width:45%; margin-left: 10px'>Yes</button><button data-value='no' style='width:45%'>No</button>";
		options.noclose = true;

		var dialog = this.showMessage(content,options);
		dialog.content.style.paddingBottom = "10px";
		var buttons = dialog.content.querySelectorAll("button");
		for(var i = 0; i < buttons.length; i++)
			buttons[i].addEventListener("click", inner);

		function inner(v) {
			var v = this.dataset["value"] == "yes";
			dialog.close(); //close before callback
			if(callback) 
				callback(v);
		}

		return dialog;
	},

	/**
	* Shows a prompt dialog with a message
	* @method prompt
	* @param {String} content
	* @param {Function} callback
	* @param {Object} options ( title, width, height, content, noclose )
	**/
	prompt: function( content, callback, options )
	{
		options = options || {};
		options.className = "alert";
		options.title = options.title || "Prompt";
		options.width = options.width || 280;

		//options.height = 140 + (options.textarea ? 40 : 0);
		if (typeof(content) == "string")
			content = "<p>" + content + "</p>";

		var value = options.value || "";
		var textinput = "<input type='text' value='"+value+"'/>";
		if (options.textarea)
			textinput = "<textarea class='textfield' style='width:95%'>"+value+"</textarea>";

		content +="<p>"+textinput+"</p><button data-value='accept' style='width:45%; margin-left: 10px; margin-bottom: 10px'>Accept</button><button data-value='cancel' style='width:45%'>Cancel</button>";
		options.noclose = true;
		var dialog = this.showMessage( content, options );

		var buttons = dialog.content.querySelectorAll("button");
		for(var i = 0; i < buttons.length; i++)
			buttons[i].addEventListener("click", inner);

		var input = dialog.content.querySelector("input,textarea");
		input.addEventListener("keydown", inner_key, true);

		function inner() {
			var value = input.value;
			if(this.dataset && this.dataset["value"] == "cancel")
				value = null;
			dialog.close(); //close before callback
			if(callback)
				callback( value );
		};

		function inner_key(e)
		{
			if (!e)
				e = window.event;
			var keyCode = e.keyCode || e.which;
			if (keyCode == '13'){
				inner();
				return false;
			}		
		};

		input.focus();
		return dialog;
	},

	/**
	* Returns the URL vars ( ?foo=faa&foo2=etc )
	* @method getUrlVars
	**/
	getUrlVars: function(){
		var vars = [], hash;
		var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
		for(var i = 0; i < hashes.length; i++)
		{
		  hash = hashes[i].split('=');
		  vars.push(hash[0]);
		  vars[hash[0]] = hash[1];
		}
		return vars;
	},

	getUrlVar: function(name) {
		return LiteGUI.getUrlVars()[name];
	},

	focus: function( element )
	{
		element.focus();
	},

	/**
	* Makes one element draggable
	* @method draggable
	* @param {HTMLEntity} container the element that will be dragged
	* @param {HTMLEntity} dragger the area to start the dragging
	**/
	draggable: function(container, dragger)
	{
		dragger = dragger || container;
		dragger.addEventListener("mousedown", inner_mouse);
		dragger.style.cursor = "move";
		var prev_x = 0;
		var prev_y = 0;

		var rect = container.getClientRects()[0];
		var x = rect ? rect.left : 0;
		var y = rect ? rect.top : 0;

		container.style.position = "absolute";
		container.style.left = x + "px";
		container.style.top = y + "px";

		function inner_mouse(e)
		{
			if(e.type == "mousedown")
			{
				if(!rect)
				{
					rect = container.getClientRects()[0];
					x = rect ? rect.left : 0;
					y = rect ? rect.top : 0;
				}

				prev_x = e.clientX;
				prev_y = e.clientY;
				document.addEventListener("mousemove",inner_mouse);
				document.addEventListener("mouseup",inner_mouse);
				e.stopPropagation();
				e.preventDefault();
				return false;
			}

			if(e.type == "mouseup")
			{
				document.removeEventListener("mousemove",inner_mouse);
				document.removeEventListener("mouseup",inner_mouse);
				return;
			}

			if(e.type == "mousemove")
			{
				var deltax = e.clientX - prev_x;
				var deltay = e.clientY - prev_y;
				prev_x = e.clientX;
				prev_y = e.clientY;
				x += deltax;
				y += deltay;
				container.style.left = x + "px";
				container.style.top = y + "px";
			}
		}
	},

	/**
	* Clones object content
	* @method cloneObject
	* @param {Object} object
	* @param {Object} target
	**/
	cloneObject: function(object, target)
	{
		var o = target || {};
		for(var i in object)
		{
			if(i[0] == "_" || i.substr(0,6) == "jQuery") //skip vars with _ (they are private)
				continue;

			var v = object[i];
			if(v == null)
				o[i] = null;			
			else if ( isFunction(v) )
				continue;
			else if (typeof(v) == "number" || typeof(v) == "string")
				o[i] = v;
			else if( v.constructor == Float32Array ) //typed arrays are ugly when serialized
				o[i] = Array.apply( [], v ); //clone
			else if ( isArray(v) )
			{
				if( o[i] && o[i].constructor == Float32Array ) //reuse old container
					o[i].set(v);
				else
					o[i] = JSON.parse( JSON.stringify(v) ); //v.slice(0); //not safe using slice because it doesnt clone content, only container
			}
			else //slow but safe
			{
				try
				{
					//prevent circular recursions
					o[i] = JSON.parse( JSON.stringify(v) );
				}
				catch (err)
				{
					console.error(err);
				}
			}
		}
		return o;
	},

	special_codes: {
		close: "&#10005;"
	},

	//used to convert sizes
	sizeToCSS: function( v )
	{
		if( v ===  undefined || v === null )
			return null;
		if(v.constructor === String )
			return v;
		if(v > 0 )
			return (v|0) + "px";
		if(v < 0 )
			return "calc( 100% - " + Math.abs(v|0) + "px )";
	}
};


function purgeElement(d, skip) {
    var a = d.attributes, i, l, n;

    if (a) {
        for (i = a.length - 1; i >= 0; i -= 1) {
            n = a[i].name;
            if (typeof d[n] === 'function') {
                d[n] = null;
            }
        }
    }

    a = d.childNodes;
    if (a) {
        l = a.length;
        for (i = 0; i < l; i += 1) {
            purgeElement(d.childNodes[i]);
        }
    }

	/*
	if(!skip)
	{
		for (i in d) {
			if (typeof d[i] === 'function') {
				d[i] = null;
			}
		}
	}
	*/
}

//useful functions

//from stackoverflow http://stackoverflow.com/questions/1354064/how-to-convert-characters-to-html-entities-using-plain-javascript

if(typeof escapeHtmlEntities == 'undefined') {
        escapeHtmlEntities = function (text) {
            return text.replace(/[\u00A0-\u2666<>\&]/g, function(c) {
                return '&' + 
                (escapeHtmlEntities.entityTable[c.charCodeAt(0)] || '#'+c.charCodeAt(0)) + ';';
            });
        };

        // all HTML4 entities as defined here: http://www.w3.org/TR/html4/sgml/entities.html
        // added: amp, lt, gt, quot and apos
        escapeHtmlEntities.entityTable = {
            34 : 'quot', 
            38 : 'amp', 
            39 : 'apos', 
            60 : 'lt', 
            62 : 'gt', 
            160 : 'nbsp', 
            161 : 'iexcl', 
            162 : 'cent', 
            163 : 'pound', 
            164 : 'curren', 
            165 : 'yen', 
            166 : 'brvbar', 
            167 : 'sect', 
            168 : 'uml', 
            169 : 'copy', 
            170 : 'ordf', 
            171 : 'laquo', 
            172 : 'not', 
            173 : 'shy', 
            174 : 'reg', 
            175 : 'macr', 
            176 : 'deg', 
            177 : 'plusmn', 
            178 : 'sup2', 
            179 : 'sup3', 
            180 : 'acute', 
            181 : 'micro', 
            182 : 'para', 
            183 : 'middot', 
            184 : 'cedil', 
            185 : 'sup1', 
            186 : 'ordm', 
            187 : 'raquo', 
            188 : 'frac14', 
            189 : 'frac12', 
            190 : 'frac34', 
            191 : 'iquest', 
            192 : 'Agrave', 
            193 : 'Aacute', 
            194 : 'Acirc', 
            195 : 'Atilde', 
            196 : 'Auml', 
            197 : 'Aring', 
            198 : 'AElig', 
            199 : 'Ccedil', 
            200 : 'Egrave', 
            201 : 'Eacute', 
            202 : 'Ecirc', 
            203 : 'Euml', 
            204 : 'Igrave', 
            205 : 'Iacute', 
            206 : 'Icirc', 
            207 : 'Iuml', 
            208 : 'ETH', 
            209 : 'Ntilde', 
            210 : 'Ograve', 
            211 : 'Oacute', 
            212 : 'Ocirc', 
            213 : 'Otilde', 
            214 : 'Ouml', 
            215 : 'times', 
            216 : 'Oslash', 
            217 : 'Ugrave', 
            218 : 'Uacute', 
            219 : 'Ucirc', 
            220 : 'Uuml', 
            221 : 'Yacute', 
            222 : 'THORN', 
            223 : 'szlig', 
            224 : 'agrave', 
            225 : 'aacute', 
            226 : 'acirc', 
            227 : 'atilde', 
            228 : 'auml', 
            229 : 'aring', 
            230 : 'aelig', 
            231 : 'ccedil', 
            232 : 'egrave', 
            233 : 'eacute', 
            234 : 'ecirc', 
            235 : 'euml', 
            236 : 'igrave', 
            237 : 'iacute', 
            238 : 'icirc', 
            239 : 'iuml', 
            240 : 'eth', 
            241 : 'ntilde', 
            242 : 'ograve', 
            243 : 'oacute', 
            244 : 'ocirc', 
            245 : 'otilde', 
            246 : 'ouml', 
            247 : 'divide', 
            248 : 'oslash', 
            249 : 'ugrave', 
            250 : 'uacute', 
            251 : 'ucirc', 
            252 : 'uuml', 
            253 : 'yacute', 
            254 : 'thorn', 
            255 : 'yuml', 
            402 : 'fnof', 
            913 : 'Alpha', 
            914 : 'Beta', 
            915 : 'Gamma', 
            916 : 'Delta', 
            917 : 'Epsilon', 
            918 : 'Zeta', 
            919 : 'Eta', 
            920 : 'Theta', 
            921 : 'Iota', 
            922 : 'Kappa', 
            923 : 'Lambda', 
            924 : 'Mu', 
            925 : 'Nu', 
            926 : 'Xi', 
            927 : 'Omicron', 
            928 : 'Pi', 
            929 : 'Rho', 
            931 : 'Sigma', 
            932 : 'Tau', 
            933 : 'Upsilon', 
            934 : 'Phi', 
            935 : 'Chi', 
            936 : 'Psi', 
            937 : 'Omega', 
            945 : 'alpha', 
            946 : 'beta', 
            947 : 'gamma', 
            948 : 'delta', 
            949 : 'epsilon', 
            950 : 'zeta', 
            951 : 'eta', 
            952 : 'theta', 
            953 : 'iota', 
            954 : 'kappa', 
            955 : 'lambda', 
            956 : 'mu', 
            957 : 'nu', 
            958 : 'xi', 
            959 : 'omicron', 
            960 : 'pi', 
            961 : 'rho', 
            962 : 'sigmaf', 
            963 : 'sigma', 
            964 : 'tau', 
            965 : 'upsilon', 
            966 : 'phi', 
            967 : 'chi', 
            968 : 'psi', 
            969 : 'omega', 
            977 : 'thetasym', 
            978 : 'upsih', 
            982 : 'piv', 
            8226 : 'bull', 
            8230 : 'hellip', 
            8242 : 'prime', 
            8243 : 'Prime', 
            8254 : 'oline', 
            8260 : 'frasl', 
            8472 : 'weierp', 
            8465 : 'image', 
            8476 : 'real', 
            8482 : 'trade', 
            8501 : 'alefsym', 
            8592 : 'larr', 
            8593 : 'uarr', 
            8594 : 'rarr', 
            8595 : 'darr', 
            8596 : 'harr', 
            8629 : 'crarr', 
            8656 : 'lArr', 
            8657 : 'uArr', 
            8658 : 'rArr', 
            8659 : 'dArr', 
            8660 : 'hArr', 
            8704 : 'forall', 
            8706 : 'part', 
            8707 : 'exist', 
            8709 : 'empty', 
            8711 : 'nabla', 
            8712 : 'isin', 
            8713 : 'notin', 
            8715 : 'ni', 
            8719 : 'prod', 
            8721 : 'sum', 
            8722 : 'minus', 
            8727 : 'lowast', 
            8730 : 'radic', 
            8733 : 'prop', 
            8734 : 'infin', 
            8736 : 'ang', 
            8743 : 'and', 
            8744 : 'or', 
            8745 : 'cap', 
            8746 : 'cup', 
            8747 : 'int', 
            8756 : 'there4', 
            8764 : 'sim', 
            8773 : 'cong', 
            8776 : 'asymp', 
            8800 : 'ne', 
            8801 : 'equiv', 
            8804 : 'le', 
            8805 : 'ge', 
            8834 : 'sub', 
            8835 : 'sup', 
            8836 : 'nsub', 
            8838 : 'sube', 
            8839 : 'supe', 
            8853 : 'oplus', 
            8855 : 'otimes', 
            8869 : 'perp', 
            8901 : 'sdot', 
            8968 : 'lceil', 
            8969 : 'rceil', 
            8970 : 'lfloor', 
            8971 : 'rfloor', 
            9001 : 'lang', 
            9002 : 'rang', 
            9674 : 'loz', 
            9824 : 'spades', 
            9827 : 'clubs', 
            9829 : 'hearts', 
            9830 : 'diams', 
            338 : 'OElig', 
            339 : 'oelig', 
            352 : 'Scaron', 
            353 : 'scaron', 
            376 : 'Yuml', 
            710 : 'circ', 
            732 : 'tilde', 
            8194 : 'ensp', 
            8195 : 'emsp', 
            8201 : 'thinsp', 
            8204 : 'zwnj', 
            8205 : 'zwj', 
            8206 : 'lrm', 
            8207 : 'rlm', 
            8211 : 'ndash', 
            8212 : 'mdash', 
            8216 : 'lsquo', 
            8217 : 'rsquo', 
            8218 : 'sbquo', 
            8220 : 'ldquo', 
            8221 : 'rdquo', 
            8222 : 'bdquo', 
            8224 : 'dagger', 
            8225 : 'Dagger', 
            8240 : 'permil', 
            8249 : 'lsaquo', 
            8250 : 'rsaquo', 
            8364 : 'euro'
        };
    }

function beautifyCode( code, reserved, skip_css )
{
	reserved = reserved || ["abstract", "else", "instanceof", "super", "boolean", "enum", "int", "switch", "break", "export", "interface", "synchronized", "byte", "extends", "let", "this", "case", "false", "long", "throw", "catch", "final", "native", "throws", "char", "finally", "new", "transient", "class", "float", "null", "true", "const", "for", "package", "try", "continue", "function", "private", "typeof", "debugger", "goto", "protected", "var", "default", "if", "public", "void", "delete", "implements", "return", "volatile", "do", "import", "short", "while", "double", "in", "static", "with"];

	//reserved words
	code = code.replace(/(\w+)/g, function(v) {
		if(reserved.indexOf(v) != -1)
			return "<span class='rsv'>" + v + "</span>";
		return v;
	});

	//numbers
	code = code.replace(/([0-9]+)/g, function(v) {
		return "<span class='num'>" + v + "</span>";
	});

	//obj.method
	code = code.replace(/(\w+\.\w+)/g, function(v) {
		var t = v.split(".");
		return "<span class='obj'>" + t[0] + "</span>.<span class='prop'>" + t[1] + "</span>";
	});

	//function
	code = code.replace(/(\w+)\(/g, function(v) {
		return "<span class='prop'>" + v.substr(0, v.length - 1) + "</span>(";
	});

	//strings
	code = code.replace(/(\"(\\.|[^\"])*\")/g, function(v) {
		return "<span class='str'>" + v + "</span>";
	});

	//comments
	code = code.replace(/(\/\/[a-zA-Z0-9\?\!\(\)_ ]*)/g, function(v) {
		return "<span class='cmnt'>" + v + "</span>";
	});

	if(!skip_css)
		code = "<style>.obj { color: #79B; } .prop { color: #B97; }	.str,.num { color: #A79; } .cmnt { color: #798; } .rsv { color: #9AB; } </style>" + code;

	return code;
}

function beautifyJSON( code, skip_css )
{
	if(typeof(code) == "object")
		code = JSON.stringify(code);

	var reserved = ["false", "true", "null"];

	//reserved words
	code = code.replace(/(\w+)/g, function(v) {
		if(reserved.indexOf(v) != -1)
			return "<span class='rsv'>" + v + "</span>";
		return v;
	});


	//numbers
	code = code.replace(/([0-9]+)/g, function(v) {
		return "<span class='num'>" + v + "</span>";
	});

	//obj.method
	code = code.replace(/(\w+\.\w+)/g, function(v) {
		var t = v.split(".");
		return "<span class='obj'>" + t[0] + "</span>.<span class='prop'>" + t[1] + "</span>";
	});

	//strings
	code = code.replace(/(\"(\\.|[^\"])*\")/g, function(v) {
		return "<span class='str'>" + v + "</span>";
	});

	//comments
	code = code.replace(/(\/\/[a-zA-Z0-9\?\!\(\)_ ]*)/g, function(v) {
		return "<span class='cmnt'>" + v + "</span>";
	});

	if(!skip_css)
		code = "<style>.obj { color: #79B; } .prop { color: #B97; }	.str { color: #A79; } .num { color: #B97; } .cmnt { color: #798; } .rsv { color: #9AB; } </style>" + code;

	return code;
}