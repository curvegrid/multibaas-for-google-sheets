// Copyright (c) 2020 Curvegrid Inc.

/**
 * Concat logs to return to API call
 */
let log = '';
function loggerAPI(msg) {
  if (msg) {
    log += `${msg}\n`;
  }
  return log;
}

/**
 * Init test with GasT to run tests on Apps Script
 *
 * @param {switchLogger} Switch logger for between GCP and API call
 */
function initTest(customLogger) {
  // GasT Initialization.
  if ((typeof GasTap) === 'undefined') {
    // eslint-disable-next-line no-eval
    eval(UrlFetchApp.fetch('https://raw.githubusercontent.com/zixia/gast/master/src/gas-tap-lib.js').getContentText());
  }

  if (typeof customLogger !== 'function') {
    // For logging test results on GCP
    return new GasTap();
  }

  // For responding test results to API call
  return new GasTap({
    logger: loggerAPI,
  });
}

/**
 * Run test
 * @param {test} GasT object
 * @param {config} Config object
 * `param {testCase} Test contents object
 */
function run(test, config, testCase) {
  test(testCase.name, (t) => {
    if (testCase.skip) {
      return;
    }

    /* eslint-disable no-undef */
    setProperty(PROP_MB_DEPLOYMENT_ID, config.deployment);
    setProperty(PROP_MB_API_KEY, config.apiKey);
    /* eslint-enable no-undef */

    const output = testCase.func(...testCase.args);
    const numRow = Array.isArray(output) ? output.length : 0;
    const numCol = numRow > 0 ? output[0].length : 0;

    if (testCase.debug) {
      loggerAPI(`OUTPUT: ${output}`);
      loggerAPI(`OUTPUT ROW, COL: ${numRow}, ${numCol}`);
    }

    // Write on test sheet
    config.sheet.clearContents();
    if (numRow > 0 && numCol > 0) {
      config.sheet.getRange(1, 1, numRow, numCol).setValues(output);
    } else {
      config.sheet.getRange(1, 1).setValue(output);
    }
    SpreadsheetApp.flush();

    let actualSheet;
    if (numRow > 0 && numCol > 0) {
      actualSheet = config.sheet.getRange(1, 1, numRow, numCol).getValues();
    } else {
      actualSheet = config.sheet.getRange(1, 1).getValue();
    }

    if (testCase.debug) {
      loggerAPI(`Actual Values: ${JSON.stringify(actualSheet)}`);
      loggerAPI(`Expected Values: ${JSON.stringify(testCase.expected)}`);
    }

    // Actual values which is stored in spreadsheet after API call
    console.log(`Actual vs. Expected: ${JSON.stringify(actualSheet)} vs. ${JSON.stringify(testCase.expected)}`);
    t.deepEqual(actualSheet, testCase.expected, 'data in the sheet should be same');

    // Keep final data in the spreadsheet
    if (!testCase.debug) {
      config.sheet.clearContents();
    }
  });
}

/**
 * Called from outside to run tests and return test results
 */
// eslint-disable-next-line no-unused-vars
function testRunner(testSheetURL) {
  const test = initTest(loggerAPI);
  const ss = SpreadsheetApp.openByUrl(testSheetURL);
  SpreadsheetApp.setActiveSpreadsheet(ss);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  const config = {
    deployment: sheet.getRange('B1').getValue(),
    apiKey: sheet.getRange('B2').getValue(),
    sheet: SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Test'),
  };
  const testCases = [
    {
      name: 'TestMBADDRESS',
      skip: false,
      only: false,
      debug: false,
      func: MBADDRESS,
      isTemplate: false,
      args: ['0xe9f2E2B0105B683b436Fd0d7A2895BE25c310Af7', true, false],
      expected: [
        [
          'label',
          'address',
          'balance',
          'chain',
          'isContract',
          'modules',
          'contracts',
        ],
        [
          'privatefaucet',
          '0xe9f2E2B0105B683b436Fd0d7A2895BE25c310Af7',
          2000000000000000000,
          'ethereum',
          true,
          '',
          'multibaasfaucet 1.0',
        ],
      ],
    },
    {
      name: 'TestMBADDRESS with code',
      skip: false,
      only: false,
      debug: false,
      func: MBADDRESS,
      isTemplate: false,
      args: ['0xe9f2E2B0105B683b436Fd0d7A2895BE25c310Af7', true, true],
      expected: [
        [
          'label',
          'address',
          'balance',
          'chain',
          'isContract',
          'modules',
          'contracts',
          'codeAt',
        ],
        [
          'privatefaucet',
          '0xe9f2E2B0105B683b436Fd0d7A2895BE25c310Af7',
          2000000000000000000,
          'ethereum',
          true,
          '',
          'multibaasfaucet 1.0',
          '0x6080604052600436106101145760003560e01c8063893d20e8116100a0578063e64a32d211610064578063e64a32d214610320578063e7f43c6814610335578063f1f959a61461034a578063f8b2cb4f1461035f578063f8e8c47f1461039257610114565b8063893d20e8146102765780638f435f071461028b578063a87430ba146102a0578063d0e30db0146102e5578063de0982a4146102ed57610114565b80633e58c58c116100e75780633e58c58c146101ed5780633f4ba83a1461022057806343b02e0a146102375780634f4b8c001461024c5780638456cb591461026157610114565b80630c432e061461014b5780631c2d3d4914610174578063270edf63146101a75780633ccfd60b146101d8575b60405162461bcd60e51b81526004018080602001828103825260238152602001806113356023913960400191505060405180910390fd5b34801561015757600080fd5b506101606103a7565b604080519115158252519081900360200190f35b34801561018057600080fd5b506101606004803603602081101561019757600080fd5b50356001600160a01b0316610441565b3480156101b357600080fd5b506101bc6105ba565b604080516001600160a01b039092168252519081900360200190f35b3480156101e457600080fd5b506101606105c9565b3480156101f957600080fd5b506101606004803603602081101561021057600080fd5b50356001600160a01b03166106ce565b34801561022c57600080fd5b50610235610981565b005b34801561024357600080fd5b506101bc610a59565b34801561025857600080fd5b50610160610a68565b34801561026d57600080fd5b50610235610b5b565b34801561028257600080fd5b506101bc610c3e565b34801561029757600080fd5b50610160610c4d565b3480156102ac57600080fd5b506102d3600480360360208110156102c357600080fd5b50356001600160a01b0316610cfc565b60408051918252519081900360200190f35b610160610d0e565b3480156102f957600080fd5b506101606004803603602081101561031057600080fd5b50356001600160a01b0316610d4c565b34801561032c57600080fd5b50610160610f1d565b34801561034157600080fd5b506101bc611014565b34801561035657600080fd5b506102d3611023565b34801561036b57600080fd5b506102d36004803603602081101561038257600080fd5b50356001600160a01b0316611027565b34801561039e57600080fd5b50610160611034565b6003546000906001600160a01b031633146103f35760405162461bcd60e51b81526004018080602001828103825260238152602001806113926023913960400191505060405180910390fd5b60028054336001600160a01b031991821681179092556003805490911690556040517fa4d7e78cbe7f44930def1dc63960dd8e4ed6b9ce7b97b357afd463ec8c95862890600090a250600190565b600080546001600160a01b0316331461048f576040805162461bcd60e51b815260206004820152601460248201526000805160206111f8833981519152604482015290519081900360640190fd5b6001546001600160a01b0316156104d75760405162461bcd60e51b81526004018080602001828103825260318152602001806112186031913960400191505060405180910390fd5b6001600160a01b03821661051c5760405162461bcd60e51b81526004018080602001828103825260218152602001806111d76021913960400191505060405180910390fd5b6000546001600160a01b03838116911614156105695760405162461bcd60e51b81526004018080602001828103825260378152602001806112ab6037913960400191505060405180910390fd5b600180546001600160a01b0319166001600160a01b03841690811790915560405133907fc9bcaee7558c5ff2404643f68fa276a8735a0c147123d31d1c3545dba95e727490600090a3506001919050565b6001546001600160a01b031690565b600080546001600160a01b03163314610617576040805162461bcd60e51b815260206004820152601460248201526000805160206111f8833981519152604482015290519081900360640190fd5b60004711610660576040805162461bcd60e51b81526020600482015260116024820152706e6f206661756365742062616c616e636560781b604482015290519081900360640190fd5b6040514790339082156108fc029083906000818181858888f1935050505015801561068f573d6000803e3d6000fd5b5060408051828152905133917fb60710c0d07c81fbd8703b496e191aae3ffc9e6d1ee11f044fb9dbf80f81d8b1919081900360200190a2600191505090565b6002546000906001600160a01b03163314610730576040805162461bcd60e51b815260206004820152601960248201527f73656e6465722073686f756c64206265206f70657261746f7200000000000000604482015290519081900360640190fd5b600154600160a01b900460ff1615610786576040805162461bcd60e51b81526020600482015260146024820152731cda1bdd5b19081b9bdd081899481c185d5cd95960621b604482015290519081900360640190fd5b670de0b6b3a764000047116107db576040805162461bcd60e51b81526020600482015260166024820152753330bab1b2ba1034b99037baba1037b31032ba3432b960511b604482015290519081900360640190fd5b6001600160a01b038216610836576040805162461bcd60e51b815260206004820152601a60248201527f72656365697665722073686f756c64206e6f7420626520307830000000000000604482015290519081900360640190fd5b6001600160a01b038216600090815260046020526040902054421161088c5760405162461bcd60e51b815260040180806020018281038252603e815260200180611249603e913960400191505060405180910390fd5b670de0b6b3a7640000826001600160a01b031631106108dc5760405162461bcd60e51b81526004018080602001828103825260538152602001806112e26053913960600191505060405180910390fd5b6108ee4261546063ffffffff61112d16565b6001600160a01b038316600081815260046020526040808220939093559151670de0b6b3a76400009290839082818181858883f19350505050158015610938573d6000803e3d6000fd5b506040805182815290516001600160a01b038516917f514687833669e436050a6109bfcf65fc63b44af6d5fd457d169761f3c3c89aa2919081900360200190a250600192915050565b6000546001600160a01b031633146109ce576040805162461bcd60e51b815260206004820152601460248201526000805160206111f8833981519152604482015290519081900360640190fd5b600154600160a01b900460ff16610a1f576040805162461bcd60e51b815260206004820152601060248201526f1cda1bdd5b19081899481c185d5cd95960821b604482015290519081900360640190fd5b6001805460ff60a01b1916905560405133907ff779549bb18027d8b598371be0088b09fcca4a91e09288bc6fc485e0865b52d690600090a2565b6003546001600160a01b031690565b600080546001600160a01b03163314610ab6576040805162461bcd60e51b815260206004820152601460248201526000805160206111f8833981519152604482015290519081900360640190fd5b6002546001600160a01b0316610b0b576040805162461bcd60e51b81526020600482015260156024820152746e6f206f70657261746f7220746f207265766f6b6560581b604482015290519081900360640190fd5b6002546040516001600160a01b039091169033907fedc095f99476acb6b4bcdc9715767369f8d423a2ca208c458234b1addabebf1490600090a350600280546001600160a01b0319169055600190565b6000546001600160a01b03163314610ba8576040805162461bcd60e51b815260206004820152601460248201526000805160206111f8833981519152604482015290519081900360640190fd5b600154600160a01b900460ff1615610bfe576040805162461bcd60e51b81526020600482015260146024820152731cda1bdd5b19081b9bdd081899481c185d5cd95960621b604482015290519081900360640190fd5b6001805460ff60a01b1916600160a01b17905560405133907fce3af5a3fdaee3c4327c1c434ea1d2186d7a9495f005d2a876dca182bd14571490600090a2565b6000546001600160a01b031690565b6001546000906001600160a01b03163314610caf576040805162461bcd60e51b815260206004820152601760248201527f73686f756c64206e6f742061636365707420616761696e000000000000000000604482015290519081900360640190fd5b60008054336001600160a01b0319918216811783556001805490921690915560405190917f2f68a0b3010e34d13a0d06c38a40584536548684eb0056ede21aaf532de3bc4b91a250600190565b60046020526000908152604090205481565b60408051348152905160009133917f62fde48a1f1e1f53dbcc1bdf035a07786f0bb6b69ec77b897bd1f42f4cd735a39181900360200190a250600190565b600080546001600160a01b03163314610d9a576040805162461bcd60e51b815260206004820152601460248201526000805160206111f8833981519152604482015290519081900360640190fd5b6003546001600160a01b031615610de25760405162461bcd60e51b81526004018080602001828103825260228152602001806111b56022913960400191505060405180910390fd5b6001600160a01b038216610e275760405162461bcd60e51b81526004018080602001828103825260248152602001806112876024913960400191505060405180910390fd5b610e2f610c3e565b6001600160a01b0316826001600160a01b03161415610e7f5760405162461bcd60e51b815260040180806020018281038252602681526020018061118f6026913960400191505060405180910390fd5b6002546001600160a01b0383811691161415610ecc5760405162461bcd60e51b815260040180806020018281038252603a815260200180611358603a913960400191505060405180910390fd5b600380546001600160a01b0319166001600160a01b03841690811790915560405133907f8524af1c68633766abb9b9dd9284a71f054a6c21cebc36c0a0dc9d70bcfa5fbb90600090a3506001919050565b600080546001600160a01b03163314610f6b576040805162461bcd60e51b815260206004820152601460248201526000805160206111f8833981519152604482015290519081900360640190fd5b6001546001600160a01b0316610fc8576040805162461bcd60e51b815260206004820152601c60248201527f6e6f206f776e65722063616e64696461746520746f207265766f6b6500000000604482015290519081900360640190fd5b6001546040516001600160a01b03909116907f1666cd85208a12e36d84f0213694d7fa987cc021f41c91a4520950176d98293790600090a250600180546001600160a01b031916815590565b6002546001600160a01b031690565b4790565b6001600160a01b03163190565b600080546001600160a01b03163314611082576040805162461bcd60e51b815260206004820152601460248201526000805160206111f8833981519152604482015290519081900360640190fd5b6003546001600160a01b03166110df576040805162461bcd60e51b815260206004820152601f60248201527f6e6f206f70657261746f722063616e64696461746520746f207265766f6b6500604482015290519081900360640190fd5b6003546040516001600160a01b03909116907fcb4610e28c7f8296925fbbec63951ed15ed3092521ea2490d967d215a36c277790600090a250600380546001600160a01b0319169055600190565b600082820183811015611187576040805162461bcd60e51b815260206004820152601b60248201527f536166654d6174683a206164646974696f6e206f766572666c6f770000000000604482015290519081900360640190fd5b939250505056fe6f70657261746f722063616e6469646174652073686f756c64206e6f74206265206f776e65726f70657261746f722063616e6469646174652073686f756c6420626520756e7365746f776e65722063616e6469646174652073686f756c64206e6f742062652030783073686f756c64206265206f6e6c79206f776e657200000000000000000000000073686f756c64206e6f742072657175657374207468652073616d65206f776e65722063616e64696461746520616761696e72656365697665722063616e206f6e6c792072657175657374206574686572206f6e636520696e20612073697820686f75722074696d652077696e646f776f70657261746f722063616e6469646174652073686f756c64206e6f74206265203078306f776e65722063616e6469646174652073686f756c64206e6f74206265207468652073616d652077697468207468652063757272656e7466617563657420776f6e27742073656e6420657468657220746f20726563697069656e7473207769746820612062616c616e63652067726561746572207468616e206f7220657175616c20746f2031206574686e6f7420616c6c6f7720746f2063616c6c2066616c6c6261636b2066756e6374696f6e6f70657261746f722063616e6469646174652073686f756c64206e6f74206265207468652073616d652077697468207468652063757272656e7473656e6465722073686f756c64206265206f70657261746f722063616e646964617465a265627a7a72315820a1887191706f4f62020796e883a22a5f25ad857f517fb96d3afda2390b84d13a64736f6c63430005110032',
        ],
      ],
    },
    {
      name: 'TestMBBLOCK',
      skip: false,
      only: false,
      debug: false,
      func: MBBLOCK,
      isTemplate: false,
      args: [1],
      expected: [
        [
          'blockchain',
          'hash',
          'difficulty',
          'gasLimit',
          'number',
          'timestamp',
          'receipt',
          'txHashes',
        ],
        [
          'ethereum',
          '0x91b8583852f0244b4c4969bef7c456898fa16d0dde5e328e4c6c0e2c086136bf',
          2,
          9990236,
          1,
          formatDateTime('2020-05-20T08:38:13.000Z'),
          '0x056b23fbba480696b65fe5a59b8f2148a1299103c4f57df839233af2cf4ca2d2',
          '0x9157a6ce0112ed417e3bda098af4fe63afbfa8af769debba3534ee24891a2050',
        ],
      ],
    },
    {
      name: 'TestMBCOMPOSE',
      skip: false,
      only: false,
      debug: false,
      func: MBCOMPOSE,
      isTemplate: false,
      args: [
        'multibaasfaucet',
        'multibaasfaucet',
        'deposit',
        '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05',
        '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05',
        '100000000000000000',
      ],
      expected: JSON.stringify({
        from: '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05',
        to: '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e',
        value: '100000000000000000',
        gas: 22774,
        gasPrice: '20000000000',
        data: '0xd0e30db0',
        nonce: 6,
        hash: '0x72f0a63bc24503d1b71e93729c7787891633aa192dadb999f87b0f343a8ecbf4',
      }),
    },
    {
      name: 'TestMBCUSTOMQUERY with no data',
      skip: false,
      only: false,
      debug: false,
      func: MBCUSTOMQUERY,
      isTemplate: false,
      args: [
        [
          [
            'eventName',
            'alias',
            'index',
            'aggregator',
            'alias',
            'index',
            'aggregator',
            'rule',
            'operand',
            'operator',
            'value',
            'rule',
            'operand',
            'operator',
            'value',
            'rule',
            'operand',
            'operator',
            'value',
          ],
          [
            'LogDeposited(address,uint256)',
            'sender',
            0,
            '',
            'amount',
            1,
            '',
            'and',
            'input0',
            'equal',
            '0x89d048be68575f2b56a999ba24faacabd1b919fb',
            'and',
            'input1',
            'greaterthan',
            1,
            'and:and',
            'block_number',
            'greaterthan',
            1,
          ],
        ],
        '',
        '',
        3,
        100000,
      ],
      expected: [],
    },
    {
      name: 'TestMBCUSTOMQUERY with filters',
      skip: false,
      only: false,
      debug: false,
      func: MBCUSTOMQUERY,
      isTemplate: false,
      args: [
        // Filters structure
        // "filter": {
        //   "rule": "And",
        //   "children": [
        //     {
        //       "operator": "Equal",
        //       "value": "0x89d048be68575f2b56a999ba24faacabd1b919fb",
        //       "fieldType": "input",
        //       "inputIndex": 0
        //     },
        //     {
        //       "operator": "GreaterThan",
        //       "value": "1",
        //       "fieldType": "input",
        //       "inputIndex": 1
        //     },
        //     {
        //       "rule": "And",
        //       "children": [
        //         {
        //           "operator": "GreaterThan",
        //           "value": "1",
        //           "fieldType": "block_number"
        //         }
        //       ]
        //     }
        //   ]
        // }
        [
          [
            'eventName',
            'alias',
            'index',
            'aggregator',
            'alias',
            'index',
            'aggregator',
            'rule',
            'operand',
            'operator',
            'value',
            'rule',
            'operand',
            'operator',
            'value',
            'rule',
            'operand',
            'operator',
            'value',
          ],
          [
            'LogDeposited(address,uint256)',
            'sender',
            0,
            '',
            'amount',
            1,
            '',
            'and',
            'input0',
            'equal',
            '0x89d048be68575f2b56a999ba24faacabd1b919fb',
            'and',
            'input1',
            'greaterthan',
            1,
            'and:and',
            'block_number',
            'greaterthan',
            1,
          ],
        ],
        '',
        '',
        3,
        0,
      ],
      expected: [
        ['amount', 'sender'],
        [1e+27, '0x89d048be68575f2b56a999ba24faacabd1b919fb'],
      ],
    },
    {
      name: 'TestMBCUSTOMQUERY with no filter',
      skip: false,
      only: false,
      debug: false,
      func: MBCUSTOMQUERY,
      isTemplate: false,
      args: [
        [
          ['eventName', 'alias', 'index', 'aggregator', 'alias', 'index', 'aggregator'],
          ['LogDeposited(address,uint256)', 'sender', 0, '', 'amount', 1, ''],
        ],
        '',
        '',
        3,
        0,
      ],
      expected: [
        ['amount', 'sender'],
        [1e+27, '0x89d048be68575f2b56a999ba24faacabd1b919fb'],
        [1000000000000000000, '0xa616eed6ad7a0cf5d2388301a710c273ca955e05'],
        [1000000000000000000, '0xbac1cd4051c378bf900087ccc445d7e7d02ad745'],
      ],
    },
    {
      name: 'TestMBCUSTOMQUERYTEMPLATE with 2 filters',
      skip: false,
      only: false,
      debug: false,
      func: MBCUSTOMQUERYTEMPLATE,
      isTemplate: true,
      args: [2, 2],
      expected: [['eventName', 'alias', 'index', 'aggregator', 'alias', 'index', 'aggregator', 'rule', 'operand', 'operator', 'value', 'rule', 'operand', 'operator', 'value']],
    },
    {
      name: 'TestMBCUSTOMQUERYTEMPLATE with No filter',
      skip: false,
      only: false,
      debug: false,
      func: MBCUSTOMQUERYTEMPLATE,
      isTemplate: true,
      args: [2, 0],
      expected: [['eventName', 'alias', 'index', 'aggregator', 'alias', 'index', 'aggregator']],
    },
    {
      name: 'TestMBEVENTLIST',
      skip: false,
      only: false,
      debug: false,
      func: MBEVENTLIST,
      isTemplate: false,
      args: ['multibaasfaucet'],
      expected: [
        ['event', 'description', 'inputs'],
        ['LogCurrentOperatorRevoked', '', '2 inputs:\nowner address\noperatorRevoked address'],
        ['LogDeposited', '', '2 inputs:\nsender address\namount uint256'],
        ['LogOperatorCandidateAccepted', '', '1 input:\ncandidateAccepted address'],
        ['LogOperatorCandidateRequested', '', '2 inputs:\nowner address\ncandidate address'],
        ['LogOperatorCandidateRevoked', '', '1 input:\ncandidateRevoked address'],
        ['LogOwnerCandidateAccepted', '', '1 input:\ncandidateAccepted address'],
        ['LogOwnerCandidateRequested', '', '2 inputs:\nowner address\ncandidate address'],
        ['LogOwnerCandidateRevoked', '', '1 input:\ncandidateRevoked address'],
        ['LogPaused', '', '1 input:\nowner address'],
        ['LogSent', '', '2 inputs:\nreceiver address\namount uint256'],
        ['LogUnpaused', '', '1 input:\nowner address'],
        ['LogWithdrew', '', '2 inputs:\nowner address\namount uint256'],
      ],
    },
    {
      name: 'TestMBEVENTS without limit (default is 10)',
      skip: false,
      only: false,
      debug: false,
      func: MBEVENTS,
      isTemplate: false,
      args: ['multibaasfaucet'],
      expected: [
        [
          'triggeredAt',
          'eventName',
          'eventDef',
          'eventInput0',
          'eventInput1',
          'eventIndexInLog',
          'eventContractAddressLabel',
          'eventContractAddress',
          'eventContractName',
          'txFrom',
          'txData',
          'txHash',
          'txIndexInBlock',
          'txBlockHash',
          'txBlockNumber',
          'txContractAddressLabel',
          'txContractAddress',
          'txContractName',
          'fnName',
          'fnDef',
          'methodInput0',
        ],
        [formatDateTime('2020-11-09T13:50:55.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xf991A961d45667F78A49D3D802fd0EDF65118924', 1000000000000000000, formatDateTime('1899-12-29T15:00:00.000Z'), 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000f991a961d45667f78a49d3d802fd0edf65118924', '0xbb4164ca1fae2734aad0fe934a12ab93a159085dae05aabbd1a7211dfa9f02b1', 0, '0xde3bb68ad8abf51c3468d7835a4934de85b5721a06e685451f598c5a9416317b', 593, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xf991A961d45667F78A49D3D802fd0EDF65118924'],
        [formatDateTime('2020-11-09T12:57:39.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000cefb3a1740155a7b37c4373ee9e66ef53d9cb5d', '0xdbe53378949a8e0097ead216b99dd29e98e5b1770063c6ab4d3070d55f5651f0', 0, '0x52d34090fbc00b8fd385330550af0d018455ef7a2cc0bb2802f9f356d6785434', 584, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d'],
        [formatDateTime('2020-11-05T11:21:52.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000cefb3a1740155a7b37c4373ee9e66ef53d9cb5d', '0x05a934f6f8f49cad4ff45bcc9bb18270f46e73588ce8241eaea02bfb06f20ace', 0, '0xf9b52389a2f71f3c58bee470f50c120dd8555735a0fd3117659ea340f425e818', 549, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d'],
        [formatDateTime('2020-11-05T11:21:41.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000004555a429df5cc32efa46bcb1412a3cd7bf14b381', '0x3e7afcb4e71fdeffcd85162dac57a9398fb78ec7b0eee8b536a38cd3d09f36ce', 0, '0x989871e2201a1c686686aa54b66abbcaf5535d1d5cd18984f25382fd5ad4b6e2', 548, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381'],
        [formatDateTime('2020-10-30T18:53:04.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000004555a429df5cc32efa46bcb1412a3cd7bf14b381', '0xd5d32dc2264994f8385ce9710f3f8c18b4711fd671b0b2dc4396b9d3bc60b019', 0, '0x3ace69426de6a160d8ffba7cc33ca8f61b5af8bd0a10c2cd31976d8bd08694cc', 497, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381'],
        [formatDateTime('2020-10-30T12:16:02.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000cefb3a1740155a7b37c4373ee9e66ef53d9cb5d', '0x4b05bd44b6c5364d415bc9fcdce41f08365bbb4c873a28c84019df46a4a4dacf', 0, '0xfae8172a0884fd3e294f7037b64ff76e4035e6f5d07c730871f0c6e1e39d4310', 492, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d'],
        [formatDateTime('2020-10-28T13:15:10.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000004555a429df5cc32efa46bcb1412a3cd7bf14b381', '0x2ccc4218e9da461bc0c0aba797ab41838408594aaacf7354d36e48c4d9bef2be', 0, '0xe4213c22adf2a158f97716f0e98a533a33ba6b7c3423bca19011b0bb9ceb6be5', 490, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381'],
        [formatDateTime('2020-10-16T03:03:23.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x39B6612FeF5Add119D653cd1D3582685ed07c99a', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c00000000000000000000000039b6612fef5add119d653cd1d3582685ed07c99a', '0x4b68169933a4ebc169198419bc5efa3caab02cddbf529cde43dcae18dbd02687', 0, '0x9b720a699917e882b4b0f0019d978891e3bbb7b1d98497d970c0a9074ab832d5', 431, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x39B6612FeF5Add119D653cd1D3582685ed07c99a'],
        [formatDateTime('2020-10-16T03:00:45.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0B78f59a375dd8602070c2579346507004db429E', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000b78f59a375dd8602070c2579346507004db429e', '0x824dbf56e16902c058479dc57cf4a30ae18ad547926eb6682bd6ba4d78860f79', 0, '0x839a65b68f0b05d85264e4e347ab1fa11eb1c34935f84f643d67a5c9a3566ed3', 430, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0B78f59a375dd8602070c2579346507004db429E'],
        [formatDateTime('2020-10-15T03:01:44.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000cefb3a1740155a7b37c4373ee9e66ef53d9cb5d', '0xdffe968545a54d0d2f7c2e51e11c94976abf35c33d742b478365312d5e79aed8', 0, '0x15afd654b3cb3bad514c29b52a7b5df2a8267ab54669347e1a4afffbb08ebfb7', 425, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d'],
      ],
    },
    {
      name: 'TestMBEVENTS with limit 1',
      skip: false,
      only: false,
      debug: false,
      func: MBEVENTS,
      isTemplate: false,
      args: ['multibaasfaucet', 1],
      expected: [
        [
          'triggeredAt',
          'eventName',
          'eventDef',
          'eventInput0',
          'eventInput1',
          'eventIndexInLog',
          'eventContractAddressLabel',
          'eventContractAddress',
          'eventContractName',
          'txFrom',
          'txData',
          'txHash',
          'txIndexInBlock',
          'txBlockHash',
          'txBlockNumber',
          'txContractAddressLabel',
          'txContractAddress',
          'txContractName',
          'fnName',
          'fnDef',
          'methodInput0',
        ],
        [formatDateTime('2020-11-09T13:50:55.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xf991A961d45667F78A49D3D802fd0EDF65118924', 1000000000000000000, formatDateTime('1899-12-29T15:00:00.000Z'), 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000f991a961d45667f78a49d3d802fd0edf65118924', '0xbb4164ca1fae2734aad0fe934a12ab93a159085dae05aabbd1a7211dfa9f02b1', 0, '0xde3bb68ad8abf51c3468d7835a4934de85b5721a06e685451f598c5a9416317b', 593, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xf991A961d45667F78A49D3D802fd0EDF65118924'],
      ],
    },
    {
      name: 'TestMBEVENTS with limit 39 and offset 1',
      skip: false,
      only: false,
      debug: false,
      func: MBEVENTS,
      isTemplate: false,
      args: ['multibaasfaucet', 39, 1],
      expected: [
        [
          'triggeredAt',
          'eventName',
          'eventDef',
          'eventInput0',
          'eventInput1',
          'eventIndexInLog',
          'eventContractAddressLabel',
          'eventContractAddress',
          'eventContractName',
          'txFrom',
          'txData',
          'txHash',
          'txIndexInBlock',
          'txBlockHash',
          'txBlockNumber',
          'txContractAddressLabel',
          'txContractAddress',
          'txContractName',
          'fnName',
          'fnDef',
          'methodInput0',
        ],
        [formatDateTime('2020-11-09T12:57:39.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d', 1000000000000000000, formatDateTime('1899-12-29T15:00:00.000Z'), 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000cefb3a1740155a7b37c4373ee9e66ef53d9cb5d', '0xdbe53378949a8e0097ead216b99dd29e98e5b1770063c6ab4d3070d55f5651f0', 0, '0x52d34090fbc00b8fd385330550af0d018455ef7a2cc0bb2802f9f356d6785434', 584, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d'],
        [formatDateTime('2020-11-05T11:21:52.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000cefb3a1740155a7b37c4373ee9e66ef53d9cb5d', '0x05a934f6f8f49cad4ff45bcc9bb18270f46e73588ce8241eaea02bfb06f20ace', 0, '0xf9b52389a2f71f3c58bee470f50c120dd8555735a0fd3117659ea340f425e818', 549, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d'],
        [formatDateTime('2020-11-05T11:21:41.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000004555a429df5cc32efa46bcb1412a3cd7bf14b381', '0x3e7afcb4e71fdeffcd85162dac57a9398fb78ec7b0eee8b536a38cd3d09f36ce', 0, '0x989871e2201a1c686686aa54b66abbcaf5535d1d5cd18984f25382fd5ad4b6e2', 548, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381'],
        [formatDateTime('2020-10-30T18:53:04.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000004555a429df5cc32efa46bcb1412a3cd7bf14b381', '0xd5d32dc2264994f8385ce9710f3f8c18b4711fd671b0b2dc4396b9d3bc60b019', 0, '0x3ace69426de6a160d8ffba7cc33ca8f61b5af8bd0a10c2cd31976d8bd08694cc', 497, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381'],
        [formatDateTime('2020-10-30T12:16:02.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000cefb3a1740155a7b37c4373ee9e66ef53d9cb5d', '0x4b05bd44b6c5364d415bc9fcdce41f08365bbb4c873a28c84019df46a4a4dacf', 0, '0xfae8172a0884fd3e294f7037b64ff76e4035e6f5d07c730871f0c6e1e39d4310', 492, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d'],
        [formatDateTime('2020-10-28T13:15:10.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000004555a429df5cc32efa46bcb1412a3cd7bf14b381', '0x2ccc4218e9da461bc0c0aba797ab41838408594aaacf7354d36e48c4d9bef2be', 0, '0xe4213c22adf2a158f97716f0e98a533a33ba6b7c3423bca19011b0bb9ceb6be5', 490, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x4555A429Df5Cc32efa46BCb1412a3CD7Bf14b381'],
        [formatDateTime('2020-10-16T03:03:23.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x39B6612FeF5Add119D653cd1D3582685ed07c99a', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c00000000000000000000000039b6612fef5add119d653cd1d3582685ed07c99a', '0x4b68169933a4ebc169198419bc5efa3caab02cddbf529cde43dcae18dbd02687', 0, '0x9b720a699917e882b4b0f0019d978891e3bbb7b1d98497d970c0a9074ab832d5', 431, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x39B6612FeF5Add119D653cd1D3582685ed07c99a'],
        [formatDateTime('2020-10-16T03:00:45.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0B78f59a375dd8602070c2579346507004db429E', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000b78f59a375dd8602070c2579346507004db429e', '0x824dbf56e16902c058479dc57cf4a30ae18ad547926eb6682bd6ba4d78860f79', 0, '0x839a65b68f0b05d85264e4e347ab1fa11eb1c34935f84f643d67a5c9a3566ed3', 430, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0B78f59a375dd8602070c2579346507004db429E'],
        [formatDateTime('2020-10-15T03:01:44.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000cefb3a1740155a7b37c4373ee9e66ef53d9cb5d', '0xdffe968545a54d0d2f7c2e51e11c94976abf35c33d742b478365312d5e79aed8', 0, '0x15afd654b3cb3bad514c29b52a7b5df2a8267ab54669347e1a4afffbb08ebfb7', 425, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0cEfB3a1740155a7b37C4373ee9e66EF53D9cb5d'],
        [formatDateTime('2020-08-21T03:45:43.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xff6bD443ce15da0aaE9FA88b4433505e4Df92c93', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000ff6bd443ce15da0aae9fa88b4433505e4df92c93', '0x52a25d679277fa48dda1875d760de0b343dc5b31583639811fab42e4de20b72f', 0, '0x36a027014d23cdfa4c58730d0c28a614b77a9c60e7ef543b805a19c1555f33bf', 328, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xff6bD443ce15da0aaE9FA88b4433505e4Df92c93'],
        [formatDateTime('2020-08-21T12:42:03.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x1f9dC5D7a2f493fee06e4454C9790ADDC2B92BD0', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000001f9dc5d7a2f493fee06e4454c9790addc2b92bd0', '0x4e1ea1915877d285bdfc79f7fc1971d0a5f784d3f127367ea7fd9dfb279a5cde', 0, '0x8b05d799b9172361ade8ceb2efb8ab8f5ff6e617f63e0f736c38013e9896111a', 298, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x1f9dC5D7a2f493fee06e4454C9790ADDC2B92BD0'],
        [formatDateTime('2020-08-21T11:13:49.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x4330365E92cd7BE75588Df9A6556090f206B6049', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000004330365e92cd7be75588df9a6556090f206b6049', '0x70ef5415eb9a34a635244074cb86ef40bb470fd506a3d4b6dbfd924ba450bafb', 0, '0x93048a54d8026f200991a89ec7588aef36b5283bae76d3fec6ddb2fef01f583d', 289, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x4330365E92cd7BE75588Df9A6556090f206B6049'],
        [formatDateTime('2020-08-21T07:20:15.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x4c6AcF409680Cd9BA1fcC6Df324FE06cfa4C7fB6', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000004c6acf409680cd9ba1fcc6df324fe06cfa4c7fb6', '0x88cc841068f61c0d61583cd598552b4c40ec0a7f38a091fdebe8df670f9934c2', 0, '0xfbdda6418590120ab2ae6fa7c8f7189ba8e50c477da4138b81828dfbea5a3814', 233, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x4c6AcF409680Cd9BA1fcC6Df324FE06cfa4C7fB6'],
        [formatDateTime('2020-08-20T14:52:31.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x4c6AcF409680Cd9BA1fcC6Df324FE06cfa4C7fB6', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000004c6acf409680cd9ba1fcc6df324fe06cfa4c7fb6', '0xff5730d18975795769ef93c0fca6bd6239b7dd3ace2f3aef6fa029eed1659447', 0, '0xa68f4d269c37d2027bb24899713595f00f12179915be4e553bd556c00542dcff', 224, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x4c6AcF409680Cd9BA1fcC6Df324FE06cfa4C7fB6'],
        [formatDateTime('2020-08-19T10:57:04.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x235EAEBE0E236F7Bc1b3c533661A365859579e8f', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000235eaebe0e236f7bc1b3c533661a365859579e8f', '0x5343e246d61923245a7949ae755347458d5a093b0d3f8d5bc0da9f96492d83ef', 0, '0x5523d995c5aa8c82f9c0de2019995506040e3923bb9d53f4eaa0565e339de08b', 215, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x235EAEBE0E236F7Bc1b3c533661A365859579e8f'],
        [formatDateTime('2020-08-03T03:10:23.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xF9450D254A66ab06b30Cfa9c6e7AE1B7598c7172', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000f9450d254a66ab06b30cfa9c6e7ae1b7598c7172', '0xeb5e23d598e5cfa19b3cc546ee989756358cafcca24a91ce51e044865c2ae115', 0, '0x98484b55d346bc414b00f7d55c3169ab5608fd6548c86357eb9a806284953cde', 201, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xF9450D254A66ab06b30Cfa9c6e7AE1B7598c7172'],
        [formatDateTime('2020-06-19T08:43:46.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000a616eed6ad7a0cf5d2388301a710c273ca955e05', '0x80d4b48e0575510d869209fa65cdbbf0de2549a13d5a2dff266f6d98458522ee', 0, '0x28b8b92f31c3596bd26df8ac8a8948b40957c063748e996e0a1492a823cef88d', 145, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05'],
        [formatDateTime('2020-06-16T10:20:55.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xcD86D156d6D457494B0a10BDC13a8c3e46FdF402', 1000000000000000000, 1, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000cd86d156d6d457494b0a10bdc13a8c3e46fdf402', '0xbcd84120b894cf2cf1b9f046a9628c97f4c81aba602ebcc866f52fbb09fefcaf', 0, '0xb02676b19011f470e6fc9362eaca4f8305572a52597082969ecc4a233425eb9a', 137, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xcD86D156d6D457494B0a10BDC13a8c3e46FdF402'],
        [formatDateTime('2020-06-10T08:01:30.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000a616eed6ad7a0cf5d2388301a710c273ca955e05', '0xf0e4ede09c9000ca66919cd127c8ebd12ecabfaffe01c471590d84fa22d5c6ef', 0, '0x918516deb8188298cb2d6628fcab698e4939945e75605a6bd79ade81555d07db', 129, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05'],
        [formatDateTime('2020-06-05T07:59:17.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x84dBBB00fd3b878097a7AfF3Ec8239Ca784aC0a7', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c00000000000000000000000084dbbb00fd3b878097a7aff3ec8239ca784ac0a7', '0x2b2653f85af55733b4a5c1ddfb08199c6a27c76005231368c602edc6f01ffe5e', 0, '0x7ec4337dc3381c087f803c4979202b507bc4c3bc35758b660ad65a2b84226f60', 113, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x84dBBB00fd3b878097a7AfF3Ec8239Ca784aC0a7'],
        [formatDateTime('2020-06-03T09:42:33.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c00000000000000000000000057ab1ec28d129707052df4df418d58a2d46d5f51', '0x31cc3acfaf3a5fe5aebd0f54cbe3d768e33c31727f42df871a9f3f7b48f6f2b1', 0, '0xf2523e6829ba8c41dabca34511d9c39d4d10f0fb5fd1be7003b84bd533fac341', 91, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51'],
        [formatDateTime('2020-06-03T07:29:10.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000a616eed6ad7a0cf5d2388301a710c273ca955e05', '0x25ad600dd18939d1d92e9726516fba8c7016e0135812dd115a925921fb831072', 0, '0x38a5c680b6b6122fe56eeab29f3d552ef86c1818a66c9f78e28fcd0fd0a6703a', 82, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05'],
        [formatDateTime('2020-06-03T07:28:30.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xBaC1Cd4051c378bF900087CCc445d7e7d02ad745', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000bac1cd4051c378bf900087ccc445d7e7d02ad745', '0x9c2b061b1b206db43407d7dc7a52a7a3f6683b0a4715ca5a993231b338012cc0', 0, '0x9d5f9dc033cce3a5a196f5d9091f2576a8668919acd1213bde04d240298a7c87', 81, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xBaC1Cd4051c378bF900087CCc445d7e7d02ad745'],
        [formatDateTime('2020-06-03T07:28:11.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x463cf2cA815e30298574Ae910A52B40c9704E3C9', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000463cf2ca815e30298574ae910a52b40c9704e3c9', '0x5909a7cfea7ae340cf5de205f57229bdf73b60819dd022d86413fc64b66077fa', 0, '0x6909111c4d4f2510fecc984bcf8a963484180b3e4f68395cc2dccc6bd1b87dae', 80, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x463cf2cA815e30298574Ae910A52B40c9704E3C9'],
        [formatDateTime('2020-06-03T07:28:03.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xc6BD6FcD4E7395Da84D31BE87af20DC7A389109c', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000c6bd6fcd4e7395da84d31be87af20dc7a389109c', '0x2410e4bc922856dd45a64285c72d4b6400fbe919d530904962e09817a50eb44d', 0, '0x76104e3f480bf58f25bb3fe0f2973994a7e0f63ad73602cf45ebd2a27a804895', 79, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xc6BD6FcD4E7395Da84D31BE87af20DC7A389109c'],
        [formatDateTime('2020-06-03T07:27:42.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xB54599080AfB3342660a907193087783857B3A3A', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000b54599080afb3342660a907193087783857b3a3a', '0xb79f089f481597cefd100e3f3f23fda47b27cd2458e92186cd0149556b957ce6', 0, '0x84c203c67f3bc234afb528b739d1ccfce46435e2c8f06b2e67a336a2cd795ae0', 78, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xB54599080AfB3342660a907193087783857B3A3A'],
        [formatDateTime('2020-06-03T07:27:21.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x672b39F0D2609a6FeC23358f4b8D8c92104BAF56', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000672b39f0d2609a6fec23358f4b8d8c92104baf56', '0x25d3cbd101bf2151c3dcc6e375ee6f64a47f2c9c96af2cb4be6bf07d56c2126b', 0, '0x0b8063b7627965eb05ee3dbc4499e56f484662bf06aed7960f75fcfe2508762c', 77, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x672b39F0D2609a6FeC23358f4b8D8c92104BAF56'],
        [formatDateTime('2020-06-03T02:56:13.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x286BDA1413a2Df81731D4930ce2F862a35A609fE', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000286bda1413a2df81731d4930ce2f862a35a609fe', '0xac7fab5551af2470dca822e8c7abee6d3a281a968ba97e31e41c3d0ced864d96', 0, '0x7493e77f5c13542a1117f2dbf83311de2f9dff91ecd2ade598568d00f9a64ada', 76, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x286BDA1413a2Df81731D4930ce2F862a35A609fE'],
        [formatDateTime('2020-06-03T00:46:04.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x34A971cA2fd6DA2Ce2969D716dF922F17aAA1dB0', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c00000000000000000000000034a971ca2fd6da2ce2969d716df922f17aaa1db0', '0x709ad0e380d8119d54dcc0489630db742229b68f3fe16bb4411b7d4a1775c575', 0, '0x6253be6e3c32da42c483cabd5d40b2eb071482398de7ff65bbfbfadc082a7044', 73, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x34A971cA2fd6DA2Ce2969D716dF922F17aAA1dB0'],
        [formatDateTime('2020-06-02T09:35:18.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x5D0af8790F21375C65A75C3822d75fEe75BfC649', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000005d0af8790f21375c65a75c3822d75fee75bfc649', '0x7348f73af2a4d9d6c6eb14e86b4743ee0cb558c56ecf867d83fa299c9dd8d5e8', 0, '0x1a87c570ba07b809777c7a9e5af5e103dd90d9996c1aeab336b4b19ba07b8377', 62, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x5D0af8790F21375C65A75C3822d75fEe75BfC649'],
        [formatDateTime('2020-06-02T09:18:01.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x3F37278403BF4Fa7c2B8fa0D21Af353c554641A1', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000003f37278403bf4fa7c2b8fa0d21af353c554641a1', '0x80706e6edb14a3c7c8dc7aacef63abfdc58e0bc81d00e9c2979c479d0f4f4bfb', 0, '0xd849bb8790ff98cccd1a29a61e8b3ee959f9cb63782902755ce80523798643b1', 61, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x3F37278403BF4Fa7c2B8fa0D21Af353c554641A1'],
        [formatDateTime('2020-05-27T07:40:58.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x005080F78567F8001115F1eee835DD0151BEA476', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000005080f78567f8001115f1eee835dd0151bea476', '0x57f9380d4f5d5e4a76e0b21e15874b40a755c6097ace401802e0f8730baa9292', 0, '0xddef165cddf7f6f02cad950b1ab4ce8afde72e5ee9fc1ce8cb3f10187e952175', 47, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x005080F78567F8001115F1eee835DD0151BEA476'],
        [formatDateTime('2020-05-24T14:51:56.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x3f02eACbfd6dfeB19c5a56f5645c0c582c1896c2', 1000000000000000000, 1, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000003f02eacbfd6dfeb19c5a56f5645c0c582c1896c2', '0xafd5d9414399890a03c431ad3044f197609ff6898753d633f1e06ada24bb528d', 0, '0xb17687f6bda9af710942e9b7430305dbf260b6e78a4638641b3c41da8a5815aa', 22, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x3f02eACbfd6dfeB19c5a56f5645c0c582c1896c2'],
        [formatDateTime('2020-05-24T14:44:10.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xF9450D254A66ab06b30Cfa9c6e7AE1B7598c7172', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000f9450d254a66ab06b30cfa9c6e7ae1b7598c7172', '0xa1254fe4034a670cfc7177df1c42b1ddb12b51620bf61e7558b2362c53d91c76', 0, '0x2dae9b7ad8602c8aec8aaee90b9676fbe4b8bcb784eb83e3a1f30f5bb51866f1', 16, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xF9450D254A66ab06b30Cfa9c6e7AE1B7598c7172'],
        [formatDateTime('2020-05-24T06:21:44.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x0d6c3707a98bcE1A56247555c8B74242705B8acf', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000000d6c3707a98bce1a56247555c8b74242705b8acf', '0x2bcf145d473f1ddf5ed551dcd8e03e93c22300c3dbabef0fbbc821463575172e', 0, '0x15fa91f2fa742630c5bba13739dc9fbebe3761981ef32ed9d8d6e1f9be04fd60', 14, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x0d6c3707a98bcE1A56247555c8B74242705B8acf'],
        [formatDateTime('2020-05-24T06:21:27.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x005080F78567F8001115F1eee835DD0151BEA476', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000005080f78567f8001115f1eee835dd0151bea476', '0x59eee587a301a6c9f58f607272a9a42cc7d26122ff59016408f5d868a467e97c', 0, '0x3dd765cec10d959e9023731e7cebc7ee3237fb74f3eddbe0b632d5ec2dbc5604', 13, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x005080F78567F8001115F1eee835DD0151BEA476'],
        [formatDateTime('2020-05-24T04:45:37.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0xBaC1Cd4051c378bF900087CCc445d7e7d02ad745', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c000000000000000000000000bac1cd4051c378bf900087ccc445d7e7d02ad745', '0xe640265d4928ae803f569a506b5807dae76cdad515816c27457b47ff6d50f5da', 0, '0x39d70fce821e02925472001f1a19a1e78f932e7d3691b35529e40b364dd677b2', 10, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0xBaC1Cd4051c378bF900087CCc445d7e7d02ad745'],
        [formatDateTime('2020-05-20T09:55:58.000Z'), 'LogSent', 'LogSent(address receiver,uint256) amount', '0x1ca01d74dfb89655C29E3185b12747AAaDc5b774', 1000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x3A8e39B711db1eB01e1e533Fb914922A675c12Ad', '0x3e58c58c0000000000000000000000001ca01d74dfb89655c29e3185b12747aaadc5b774', '0x6a74bdece632df92f417fc44b583f29eeb914d7d2d3090753482ac28788b2f48', 0, '0x50d266c85ea25c4c5cb406fc063132cefe16e2a89fd84aae26f85939409274f4', 9, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'send', 'send(address) receiver', '0x1ca01d74dfb89655C29E3185b12747AAaDc5b774'],
        [formatDateTime('2020-05-20T09:55:40.000Z'), 'LogDeposited', 'LogDeposited(address sender,uint256) amount', '0x89D048Be68575F2B56A999Ba24Faacabd1B919FB', 1000000000000000000000000000, 0, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', '0x89D048Be68575F2B56A999Ba24Faacabd1B919FB', '0xd0e30db0', '0x8569d4c8fa1ec3b1f8a3ba9ab17bd2770db21308c190e0db430d9637df2d9326', 0, '0x67f0efd85e9b4e89063477bc13a726dc29337b3b25c115b269392385cfcd6296', 8, 'multibaasfaucet', '0x317570b8c43feCaDb8Ebaf765044Ad9626F4848e', 'MultiBaasFaucet', 'deposit', 'deposit()', ''],
      ],
    },
    {
      name: 'TestMBFUNCTIONLIST',
      skip: false,
      only: false,
      debug: false,
      func: MBFUNCTIONLIST,
      isTemplate: false,
      args: ['erc20interface'],
      expected: [
        ['function', 'description', 'read/write', 'inputs', 'outputs'],
        ['allowance', '', 'read', '2 inputs:\ntokenOwner address\nspender address', '1 output:\nremaining uint256'],
        ['approve', '', 'write', '2 inputs:\nspender address\ntokens uint256', '1 output:\nsuccess bool'],
        ['balanceOf', '', 'read', '1 input:\ntokenOwner address', '1 output:\nbalance uint256'],
        ['decimals', '', 'read', 'no inputs', '1 output:\nuint8'],
        ['name', '', 'read', 'no inputs', '1 output:\nstring'],
        ['symbol', '', 'read', 'no inputs', '1 output:\nstring'],
        ['totalSupply', '', 'read', 'no inputs', '1 output:\nuint256'],
        ['transfer', '', 'write', '2 inputs:\nto address\ntokens uint256', '1 output:\nsuccess bool'],
        ['transferFrom', '', 'write', '3 inputs:\nfrom address\nto address\ntokens uint256', '1 output:\nsuccess bool'],
      ],
    },
    {
      name: 'TestMBGET',
      skip: false,
      only: false,
      debug: false,
      func: MBGET,
      isTemplate: false,
      args: ['privatefaucet', 'multibaasfaucet', 'getOperator'],
      expected: '0x005080F78567F8001115F1eee835DD0151BEA476',
    },
    {
      name: 'TestMBPOSTTEMPLATE',
      skip: false,
      only: false,
      debug: false,
      func: MBPOSTTEMPLATE,
      isTemplate: true,
      args: [2],
      expected: [['address', 'contract', 'method', 'from', 'signer', 'input0', 'input1', 'txHash (output)']],
    },
    {
      name: 'TestMBQUERY with no data',
      skip: false,
      only: false,
      debug: false,
      func: MBQUERY,
      args: ['FaucetLogSent', 0, 100000],
      expected: [],
    },
    {
      name: 'TestMBQUERY without limit (default is 10) and offset',
      skip: false,
      only: false,
      debug: false,
      func: MBQUERY,
      args: ['FaucetLogSent'],
      expected: [
        ['amount', 'receiver'],
        [1000000000000000000, '0x1ca01d74dfb89655c29e3185b12747aaadc5b774'],
        [1000000000000000000, '0xbac1cd4051c378bf900087ccc445d7e7d02ad745'],
        [1000000000000000000, '0x005080f78567f8001115f1eee835dd0151bea476'],
        [1000000000000000000, '0x0d6c3707a98bce1a56247555c8b74242705b8acf'],
        [1000000000000000000, '0xf9450d254a66ab06b30cfa9c6e7ae1b7598c7172'],
        [1000000000000000000, '0x3f02eacbfd6dfeb19c5a56f5645c0c582c1896c2'],
        [1000000000000000000, '0x005080f78567f8001115f1eee835dd0151bea476'],
        [1000000000000000000, '0x3f37278403bf4fa7c2b8fa0d21af353c554641a1'],
        [1000000000000000000, '0x5d0af8790f21375c65a75c3822d75fee75bfc649'],
        [1000000000000000000, '0x34a971ca2fd6da2ce2969d716df922f17aaa1db0'],
      ],
    },
    {
      name: 'TestMBQUERY with limit 5 and offset 3',
      skip: false,
      only: false,
      debug: false,
      func: MBQUERY,
      args: ['FaucetLogSent', 5, 3],
      expected: [
        ['amount', 'receiver'],
        [1000000000000000000, '0x0d6c3707a98bce1a56247555c8b74242705b8acf'],
        [1000000000000000000, '0xf9450d254a66ab06b30cfa9c6e7ae1b7598c7172'],
        [1000000000000000000, '0x3f02eacbfd6dfeb19c5a56f5645c0c582c1896c2'],
        [1000000000000000000, '0x005080f78567f8001115f1eee835dd0151bea476'],
        [1000000000000000000, '0x3f37278403bf4fa7c2b8fa0d21af353c554641a1'],
      ],
    },
    {
      name: 'TestMBQUERY with limit 32',
      skip: false,
      only: false,
      debug: false,
      func: MBQUERY,
      args: ['FaucetLogSent', 32, 0],
      expected: [
        ['amount', 'receiver'],
        [1000000000000000000, '0x1ca01d74dfb89655c29e3185b12747aaadc5b774'],
        [1000000000000000000, '0xbac1cd4051c378bf900087ccc445d7e7d02ad745'],
        [1000000000000000000, '0x005080f78567f8001115f1eee835dd0151bea476'],
        [1000000000000000000, '0x0d6c3707a98bce1a56247555c8b74242705b8acf'],
        [1000000000000000000, '0xf9450d254a66ab06b30cfa9c6e7ae1b7598c7172'],
        [1000000000000000000, '0x3f02eacbfd6dfeb19c5a56f5645c0c582c1896c2'],
        [1000000000000000000, '0x005080f78567f8001115f1eee835dd0151bea476'],
        [1000000000000000000, '0x3f37278403bf4fa7c2b8fa0d21af353c554641a1'],
        [1000000000000000000, '0x5d0af8790f21375c65a75c3822d75fee75bfc649'],
        [1000000000000000000, '0x34a971ca2fd6da2ce2969d716df922f17aaa1db0'],
        [1000000000000000000, '0x286bda1413a2df81731d4930ce2f862a35a609fe'],
        [1000000000000000000, '0x672b39f0d2609a6fec23358f4b8d8c92104baf56'],
        [1000000000000000000, '0xb54599080afb3342660a907193087783857b3a3a'],
        [1000000000000000000, '0xc6bd6fcd4e7395da84d31be87af20dc7a389109c'],
        [1000000000000000000, '0x463cf2ca815e30298574ae910a52b40c9704e3c9'],
        [1000000000000000000, '0xbac1cd4051c378bf900087ccc445d7e7d02ad745'],
        [1000000000000000000, '0xa616eed6ad7a0cf5d2388301a710c273ca955e05'],
        [1000000000000000000, '0x57ab1ec28d129707052df4df418d58a2d46d5f51'],
        [1000000000000000000, '0x84dbbb00fd3b878097a7aff3ec8239ca784ac0a7'],
        [1000000000000000000, '0xa616eed6ad7a0cf5d2388301a710c273ca955e05'],
        [1000000000000000000, '0xcd86d156d6d457494b0a10bdc13a8c3e46fdf402'],
        [1000000000000000000, '0xa616eed6ad7a0cf5d2388301a710c273ca955e05'],
        [1000000000000000000, '0xf9450d254a66ab06b30cfa9c6e7ae1b7598c7172'],
        [1000000000000000000, '0x235eaebe0e236f7bc1b3c533661a365859579e8f'],
        [1000000000000000000, '0x4c6acf409680cd9ba1fcc6df324fe06cfa4c7fb6'],
        [1000000000000000000, '0x4c6acf409680cd9ba1fcc6df324fe06cfa4c7fb6'],
        [1000000000000000000, '0x4330365e92cd7be75588df9a6556090f206b6049'],
        [1000000000000000000, '0x1f9dc5d7a2f493fee06e4454c9790addc2b92bd0'],
        [1000000000000000000, '0xff6bd443ce15da0aae9fa88b4433505e4df92c93'],
        [1000000000000000000, '0x0cefb3a1740155a7b37c4373ee9e66ef53d9cb5d'],
        [1000000000000000000, '0x0b78f59a375dd8602070c2579346507004db429e'],
        [1000000000000000000, '0x39b6612fef5add119d653cd1d3582685ed07c99a'],
      ],
    },
    {
      name: 'TestMBQUERY with limit all (infinity)',
      skip: false,
      only: false,
      debug: false,
      func: MBQUERY,
      args: ['FaucetLogSent', -1, 0],
      expected: [
        ['amount', 'receiver'],
        [1000000000000000000, '0x1ca01d74dfb89655c29e3185b12747aaadc5b774'],
        [1000000000000000000, '0xbac1cd4051c378bf900087ccc445d7e7d02ad745'],
        [1000000000000000000, '0x005080f78567f8001115f1eee835dd0151bea476'],
        [1000000000000000000, '0x0d6c3707a98bce1a56247555c8b74242705b8acf'],
        [1000000000000000000, '0xf9450d254a66ab06b30cfa9c6e7ae1b7598c7172'],
        [1000000000000000000, '0x3f02eacbfd6dfeb19c5a56f5645c0c582c1896c2'],
        [1000000000000000000, '0x005080f78567f8001115f1eee835dd0151bea476'],
        [1000000000000000000, '0x3f37278403bf4fa7c2b8fa0d21af353c554641a1'],
        [1000000000000000000, '0x5d0af8790f21375c65a75c3822d75fee75bfc649'],
        [1000000000000000000, '0x34a971ca2fd6da2ce2969d716df922f17aaa1db0'],
        [1000000000000000000, '0x286bda1413a2df81731d4930ce2f862a35a609fe'],
        [1000000000000000000, '0x672b39f0d2609a6fec23358f4b8d8c92104baf56'],
        [1000000000000000000, '0xb54599080afb3342660a907193087783857b3a3a'],
        [1000000000000000000, '0xc6bd6fcd4e7395da84d31be87af20dc7a389109c'],
        [1000000000000000000, '0x463cf2ca815e30298574ae910a52b40c9704e3c9'],
        [1000000000000000000, '0xbac1cd4051c378bf900087ccc445d7e7d02ad745'],
        [1000000000000000000, '0xa616eed6ad7a0cf5d2388301a710c273ca955e05'],
        [1000000000000000000, '0x57ab1ec28d129707052df4df418d58a2d46d5f51'],
        [1000000000000000000, '0x84dbbb00fd3b878097a7aff3ec8239ca784ac0a7'],
        [1000000000000000000, '0xa616eed6ad7a0cf5d2388301a710c273ca955e05'],
        [1000000000000000000, '0xcd86d156d6d457494b0a10bdc13a8c3e46fdf402'],
        [1000000000000000000, '0xa616eed6ad7a0cf5d2388301a710c273ca955e05'],
        [1000000000000000000, '0xf9450d254a66ab06b30cfa9c6e7ae1b7598c7172'],
        [1000000000000000000, '0x235eaebe0e236f7bc1b3c533661a365859579e8f'],
        [1000000000000000000, '0x4c6acf409680cd9ba1fcc6df324fe06cfa4c7fb6'],
        [1000000000000000000, '0x4c6acf409680cd9ba1fcc6df324fe06cfa4c7fb6'],
        [1000000000000000000, '0x4330365e92cd7be75588df9a6556090f206b6049'],
        [1000000000000000000, '0x1f9dc5d7a2f493fee06e4454c9790addc2b92bd0'],
        [1000000000000000000, '0xff6bd443ce15da0aae9fa88b4433505e4df92c93'],
        [1000000000000000000, '0x0cefb3a1740155a7b37c4373ee9e66ef53d9cb5d'],
        [1000000000000000000, '0x0b78f59a375dd8602070c2579346507004db429e'],
        [1000000000000000000, '0x39b6612fef5add119d653cd1d3582685ed07c99a'],
        [1000000000000000000, '0x4555a429df5cc32efa46bcb1412a3cd7bf14b381'],
        [1000000000000000000, '0x0cefb3a1740155a7b37c4373ee9e66ef53d9cb5d'],
        [1000000000000000000, '0x4555a429df5cc32efa46bcb1412a3cd7bf14b381'],
        [1000000000000000000, '0x4555a429df5cc32efa46bcb1412a3cd7bf14b381'],
        [1000000000000000000, '0x0cefb3a1740155a7b37c4373ee9e66ef53d9cb5d'],
        [1000000000000000000, '0x0cefb3a1740155a7b37c4373ee9e66ef53d9cb5d'],
        [1000000000000000000, '0xf991a961d45667f78a49d3d802fd0edf65118924'],
      ],
    },
    {
      name: 'TestMBTX',
      skip: false,
      only: false,
      debug: false,
      func: MBTX,
      args: ['0xfe9e4b800d14c36f2e8c26ab44ffcfcbf55ac71d6f0d5f2ac95b3d63c7f71569'],
      expected: [
        [
          'isPending',
          'nonce',
          'gasPrice',
          'gas',
          'to',
          'value',
          'input',
          'v',
          'r',
          's',
          'hash',
        ],
        [
          false,
          42,
          20000000000,
          22774,
          '0xe9f2e2b0105b683b436fd0d7a2895be25c310af7',
          // TODO: Fix tx value format issue in a spreadsheet
          // https://github.com/curvegrid/multibaas-for-google-sheets/issues/15
          formatDateTime('1E+18'),
          '0xd0e30db0',
          '0xf0742a46',
          '0xf7d63ad5985bfcc8f1764198a32d7e1800e852b2408068b0904187c3e3b3c4dc',
          '0x290fae6d05ef9007ce21f8144629edbd7ebf23a1205a3b4a74a3746c6737132c',
          '0xfe9e4b800d14c36f2e8c26ab44ffcfcbf55ac71d6f0d5f2ac95b3d63c7f71569',
        ],
      ],
    },
  ];

  // TODO: cover internal functions
  // https://github.com/curvegrid/multibaas-for-google-sheets/issues/5

  let testCasesFiltered = testCases.filter((testCase) => testCase.only);
  if (testCasesFiltered.length < 1) {
    testCasesFiltered = testCases;
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const testCase of testCasesFiltered) {
    run(test, config, testCase);
  }

  test.finish();

  return { failures: test.totalFailed(), log: loggerAPI() };
}
