function testMBQUERY(test, config) {
  test('MBQUERY', (t) => {
    const output = MBQUERY(config.deployment, config.apiKey, 'Queued Exits', 5);
    config.sheet.clearContents();
    config.sheet.getRange('A1:B6').setValues(output);
    SpreadsheetApp.flush();

    const actualSheet = config.sheet.getRange('A1:B6').getValues();
    const expected = [
      ['exitid', 'priority'],
      ['666629079848833945283516969712032889240528132', '41733475565687827013448321883143303337820997464902624318864041623172916484'],
      ['1401973687505857731830456287637471880977785047', '41751861880721805686398941946704262444111373862207383147640349032816517335'],
      ['2054345912177215402617314954546801559724193123', '41752026299537173367456859727492207583157445734862728631688173641164748131'],
      ['12018136374180221520320355170630020014075267311', '41753870186123925948850253652650103648140958609936382295744042661855611119'],
      ['1805958224368381604189476822833232573913333196', '41755646356907136232573277651225957746239350543415473449459681295463054796'],
    ];
    t.deepEqual(actualSheet, expected, 'compare to response');

    config.sheet.clearContents();
  });
}

// eslint-disable-next-line no-unused-vars
function mbTestRunner() {
  // GasT Initialization.
  if ((typeof GasTap) === 'undefined') {
    // eslint-disable-next-line no-eval
    eval(UrlFetchApp.fetch('https://raw.githubusercontent.com/zixia/gast/master/src/gas-tap-lib.js').getContentText());
  }

  // For responding test results to API call
  let log = '';
  const loggerFunc = (msg) => { log += `${msg}\n`; };
  const test = new GasTap({
    logger: loggerFunc,
  });

  // For logging test results on GCP
  // const test = new GasTap();

  const testSheetURL = 'https://docs.google.com/spreadsheets/d/12jQjyXkqUooDK5wlDyazBa3xZb5NVa-YyixNtTRZIsI/edit#gid=0';
  const ss = SpreadsheetApp.openByUrl(testSheetURL);
  SpreadsheetApp.setActiveSpreadsheet(ss);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  const config = {
    deployment: sheet.getRange('B1').getValue(),
    apiKey: sheet.getRange('B2').getValue(),
    sheet: SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Test'),
  };

  testMBQUERY(test, config);

  test.finish();

  return { failures: test.totalFailed(), log };
}
