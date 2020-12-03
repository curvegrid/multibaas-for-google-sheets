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
      name: 'TestMBADDRESS with Code',
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
      name: 'TestMBCUSTOMQUERY with Filters',
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
      name: 'TestMBCUSTOMQUERY with No Filter',
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
      name: 'TestMBCUSTOMQUERYTEMPLATE with 2 Filters',
      skip: false,
      only: false,
      debug: false,
      func: MBCUSTOMQUERYTEMPLATE,
      isTemplate: true,
      args: [2, 2],
      expected: [['eventName', 'alias', 'index', 'aggregator', 'alias', 'index', 'aggregator', 'rule', 'operand', 'operator', 'value', 'rule', 'operand', 'operator', 'value']],
    },
    {
      name: 'TestMBCUSTOMQUERYTEMPLATE with No Filter',
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
      name: 'TestMBEVENTS',
      skip: false,
      only: false,
      debug: false,
      func: MBEVENTS,
      isTemplate: false,
      args: ['privatefaucet', 1, 2],
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
        ],
        [
          formatDateTime('2020-06-19T08:48:36.000Z'),
          'LogDeposited',
          'LogDeposited(address sender,uint256) amount',
          '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05',
          1000000000000000000,
          formatDateTime('1899-12-29T15:00:00.000Z'),
          'multibaasfaucet',
          '0xe9f2E2B0105B683b436Fd0d7A2895BE25c310Af7',
          'MultiBaasFaucet',
          '0xA616eEd6aD7A0cF5d2388301a710c273ca955e05',
          '0xd0e30db0',
          '0x937f1d11da26d7350e66691bd1e8669961d3cb4727978fd6213265b504174fbf',
          0,
          '0x611df11ac2d2e8a2da1e305817f1342bed60667c7d1a7292f6da09e7f4a1cc66',
          149,
          'multibaasfaucet',
          '0xe9f2E2B0105B683b436Fd0d7A2895BE25c310Af7',
          'MultiBaasFaucet',
          'deposit',
          'deposit()',
        ],
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
      name: 'TestMBQUERY with limit 0',
      skip: false,
      only: false,
      debug: false,
      func: MBQUERY,
      args: ['FaucetLogSent', 0],
      expected: [
        ['No data'],
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
      args: ['FaucetLogSent', 'all', 0],
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
