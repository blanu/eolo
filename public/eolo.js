var mustache = require('mustache');
var showdown = require('showdown');
var markdown = require('markdown').markdown;
var ghw = require('ghw');
// Mod the bracketLink transformer to not break Wiki-style links
ghw.transformers.bracketLink.toHTML=function(o) {
  return '<a href="' + o.l.replace(/ /g, '-').replace(/\?/g, '%253F')  + '">' + o.l + '</a>';
};
var underscore = require('underscore');

var converter = new showdown.Converter();

var state=new Object();
state.currentName=null;
state.currentObj=null;  
state.editMode=false;

var user = null;
var db = firebase.database();


items={
};

function init() {
  console.log('Deps:');
  console.log(markdown);
  console.log(mustache);
  console.log(showdown);
  console.log(ghw);
  console.log('.');
      
  $('#start').click(start);
  $('#edit').click(edit);
  $('#save').click(save);
  $('#add').click(add);
  $(window).bind("popstate", popstate);
  
  firebase.auth().onAuthStateChanged(auth);  
}

function start() {
  navigate("Start");
  pushState();
}

function navigate(name) {
  state.currentName=name;
  if(state.currentName in items) {
    console.log('local cache');
    state.editMode=false;
    state.currentObj=items[state.currentName];
    render(state.currentObj);    
  } else {
    console.log('remote fetch');
    var ref = db.ref(state.currentName);
    ref.on('value', function(snapshot) {
      var value = snapshot.val();

      // If item does not exist in database      
      if(value == null) {
        console.log('remote not found');
        state.currentObj=new Object();
        editMode();        
      } else {
        console.log('remote fetch successful');
        items[name]=snapshot.val();
        
        // This is called asynchronously. Are we still on the same page now?
        if(name==state.currentName) {
          // Recursively call navigate now that the item is cached locally
          navigate(name);
        }        
      }
    });
  }
}

function render(item) {
  console.log(item);
  if("description" in item) {  
    var content=mustache.render(item.description, item);
    console.log(content);
//    content=converter.makeHTML(content);
//    content=markdown.toHTML(content);
//    console.log(content);
    
    ghw.transform(content, {bracketLink: ghw.transformers.bracketLink}, function(ctx) {
      console.log(ctx.data);
      content=ctx.data;
      content=markdown.toHTML(content);
      console.log(content);
      content=underscore.unescape(content);
      console.log(content);
      $('#content').empty().append(content);
    });
  } else {
    viewItem();
  }
  
  $("#main a").click(link);
}

function defaultStart() {
  var obj=new Object();
  obj.description="Start page with description. <a href=\"Next\">Next</a>";
  obj.value="another value";
  return obj
}

function defaultNext() {
  var obj=new Object();
  obj.description="Next page with description. <a href=\"NoDesc\">NoDesc</a> <a href=\"Also\">Also</a>";
  return obj
}

function defaultNoDesc() {
  var obj=new Object();
  obj.x=0;
  obj.y=1;
  obj.s="lalala";
  return obj;
}

function edit() {
  console.log("edit");
  editMode();
  pushState();  
}
  
function editMode() {  
  console.log("editMode");
  state.editMode=true;  
  $('#viewToolbar').hide();
  $('#editToolbar').show();
    
  editItem();    
}

function save() {
  console.log("save");
  saveItem();
  viewMode();  
  
  history.replaceState(state, state.currentName, '/'+state.currentName);    
}

function viewMode() {
  console.log("viewMode");  
  $('#editToolbar').hide();
  $('#viewToolbar').show();
  navigate(state.currentName);
}

function editItem() {
  $("#content").empty();
  $("#content").append("<ul id=\"editList\"></ul>");
  for(key in state.currentObj) {
    var value=state.currentObj[key];
    console.log(value);
    viewEditField(key, value);
  }
}    

function viewEditField(key, value) {
  $("#editList").append("<li id=\""+key+"\"><label>"+key+"</label> "+editRender(key, value)+"</li>");        
}

function editRender(key, value) {
  console.log('editRender');
  console.log(value);
  var valueType = typeof value;
  console.log(valueType);
  if(valueType === "string") {
    return "<textarea valueType=\"string\" class=\"string\">"+value+"</textarea>";      
  } else if(valueType === "number") {
    return "<input type=\"next\" valueType=\"number\" class=\"number\" value=\""+value+"\"></input>";            
  } else if(valueType === "object") {
    return render(value);            
  }
}

function saveItem() {
  console.log('save');
  var keys=$.map($('#editList li'), function(item, index) {
    console.log(item);
    return $(item).attr("id");
  });
  
  console.log(keys);
  for(key of keys) {
    var value=$("#"+key).children().last().val();
    var fieldType=$("#"+key).children().last().attr('valuetype');
    console.log('saving field');
    console.log(value);
    console.log(fieldType);
    
    if(fieldType=='string') {
      state.currentObj[key]=value;      
    } else if(fieldType=='number') {
      var numValue = Number(value);
      console.log(numValue);
      
      if(!isNaN(numValue)) {
        console.log('saving not-NaN');
        state.currentObj[key]=numValue;
      }
    } else if(fieldType=='object') {
      // ???
    }
    
    items[state.currentName]=state.currentObj;
    db.ref(state.currentName).set(state.currentObj);
  }  
}

function add() {
  if($('#addNewField').length==0) {
    $("#editList").append("<li id=\"newFieldItem\"><input id=\"newfield\" type=\"text\"></input> <select id=\"newFieldType\" name=\"newFieldType\"><option value=\"string\">string</option><option value=\"number\">number</option><option value=\"object\">object</option></select> <button id=\"addNewField\">+</button></li>");     
    $('#addNewField').click(function() {
      var key=$('#newfield').val();
      var newFieldType=$('#newFieldType').val();
      $('#newFieldItem').remove();
      viewEditField(key, defaultValue(newFieldType));
    });
  }
}

function defaultValue(valueType) {
  if(valueType === "string") {
    return "";
  } else if(valueType === "number") {
    return 0;
  } else if(valueType === "object") {
    return new Object();
  }
}

function viewItem() {
  $("#content").empty();
  $("#content").append("<ul id=\"editList\"></ul>");
  for(key in state.currentObj) {
    var value=state.currentObj[key];
    viewField(key, value);
  }
}

function viewField(key, value) {
  $("#editList").append("<li><label>"+key+"</label> <span id=\""+key+"\">"+value+"</span></li>");  
}

function popstate(event) {
  console.log("popstate");
  if(event==null) {
    return;
  }
  
  var oldState=event.originalEvent.state;
  console.log(oldState);

  if(oldState==null) {
    return;    
  }
  
  if(oldState.editMode) {
    state.currentName=oldState.currentName;
    editMode();
  } else {
    state.currentName=oldState.currentName;
    viewMode();
  }     
}

function link() {
  console.log(this);
  navigate($(this).attr("href"));
  pushState();
  return false;
}

function pushState() {
  console.log('pushState');
  console.log(state);
  history.pushState(state, state.currentName, '/'+state.currentName);    
}

function auth(user) {
  console.log('auth');
  $('#loading').hide();
  
  if(user) {
    console.log("logged in");
    $('#firebaseui-auth-container').hide();
    $('#main').show();
    
    user=firebase.auth().currentUser.uid;
    
    if(window.location.pathname=='/') {
      start();      
    } else {
      navigate(window.location.pathname.substring(1));
      pushState();      
    }
  } else {
    console.log('logged out');
    $('#firebaseui-auth-container').show();    
    $('#main').hide();
  }
}

$(document).ready(init);
