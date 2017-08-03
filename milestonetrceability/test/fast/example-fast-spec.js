describe("Example test set", function() {
    it('should render the app', function() {
        var app = Rally.test.Harness.launchApp("TSMilestoneTraceability");
        expect(app.getEl()).toBeDefined();
    });

});
