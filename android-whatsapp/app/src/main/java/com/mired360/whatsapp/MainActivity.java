package com.mired360.whatsapp;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.*;
import android.content.Intent;
import android.net.Uri;
public class MainActivity extends Activity {
 private WebView web; private ValueCallback<Uri[]> fileCallback;
 private static final int FILE_REQUEST=101;
 @Override public void onCreate(Bundle b) {
  super.onCreate(b); web=new WebView(this);
  web.getSettings().setJavaScriptEnabled(true);
  web.getSettings().setDomStorageEnabled(true);
  web.getSettings().setAllowFileAccess(false);
  web.setWebChromeClient(new WebChromeClient(){
   @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params){
    if(fileCallback!=null)fileCallback.onReceiveValue(null);
    fileCallback=cb;
    try {startActivityForResult(params.createIntent(),FILE_REQUEST);return true;}
    catch(Exception e){fileCallback=null;return false;}
   }
  });
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req){
    Uri u=req.getUrl();
    if("https".equals(u.getScheme()) && ("yesid1000415.github.io".equals(u.getHost())||"lpiusomsuswdcraoozdn.supabase.co".equals(u.getHost())))return false;
    try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}
    return true;
   }
  });
  setContentView(web);
  web.loadUrl("https://yesid1000415.github.io/Mired360CRM/whatsapp-callcenter.html");
 }
 @Override protected void onActivityResult(int code,int result,Intent data){
  super.onActivityResult(code,result,data);
  if(code==FILE_REQUEST && fileCallback!=null){fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));fileCallback=null;}
 }
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(fileCallback!=null)fileCallback.onReceiveValue(null);web.destroy();super.onDestroy();}
}
