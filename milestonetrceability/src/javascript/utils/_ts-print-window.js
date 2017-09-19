Ext.define('CArABU.utils.PrintWindow',{
    title: 'Print',
    styleSheetTitle: 'printStyle',
    currentDocument: null,
    printContainer: null,
    win: null,

    constructor: function(config) {
        Ext.merge(this,config);
    },

    show: function(){
        var options = "toolbar=1,menubar=1,scrollbars=yes,scrolling=yes,resizable=yes,width=800,height=500";
        var style = this._getStyleSheet(this.styleSheetTitle);
        this.win = window.open('',this.title);

        this.win.document.write('<html><head><title>' + this.title + '</title>');
        this.win.document.write(style);
        this.win.document.write('</head><body class="portrait">');
        this.win.document.write('</body></html>');
    },

    print: function() {
        var me = this;
        if ( !this.win ) {
            this.show();
        }
        var html = this._buildHTML();

        this.win.document.body.innerHTML = html;
        // pause so the page loads before we try to print it
        setTimeout(function(){
            me.win.print();
            me.win.close();
        },1000);
    },

    _buildHTML: function() {
        if ( !this.printContainer ) { return "Nothing to print"; }
        return this.printContainer.getEl().dom.outerHTML;
    },

    _getStyleSheet: function(styleTitle) {
        var style_sheet = "";
        var links = this.currentDocument.query('link');
        for (var i=0;i<links.length; i++) {
            style_sheet += Ext.String.format(
                "<link rel='stylesheet' type='text/css' href='{0}'></link>",
                links[i].href
            )
        }
        var elems = this.currentDocument.query('style');
        for (var i=0; i< elems.length; i++){
            //if (elems[i].title == styleTitle) {
                style_sheet += Ext.String.format("<style type='text/css'>{0}</style>", elems[i].innerHTML);
            //}
        }
        return style_sheet;
    }
});
