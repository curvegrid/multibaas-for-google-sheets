// Copyright (c) 2020 Curvegrid Inc.

/* eslint-disable no-unused-vars */
const VALID_AGGREGATORS = ['subtract', 'add', 'first', 'last', 'max', 'min', ''];
const VALID_BOOLEANS = ['and', 'or'];
const VALID_OPERATORS = ['equal', 'notequal', 'lessthan', 'greaterthan'];
const VALID_OPERANDS = ['input', 'contracts.label', 'contracts.contract_name', 'addresses.address', 'addresses.label'];

function validateOperator(operator) {
  const operatorLower = String(operator).toLowerCase();
  if (!VALID_OPERATORS.includes(operatorLower)) {
    throw new Error(`'${operatorLower}' is not a valid operator, must be one of ${VALID_OPERATORS.join(',')}`);
  }

  return operatorLower;
}

function validateAggregator(aggregator) {
  const aggregatorLower = String(aggregator).toLowerCase();
  if (!VALID_AGGREGATORS.includes(aggregatorLower)) {
    throw new Error(`'${aggregatorLower}' is not a valid aggregator, must be one of ${VALID_AGGREGATORS.join(',')}`);
  }

  return aggregatorLower;
}

function validateBlockTxHash(hash) {
  const hashString = String(hash);

  if (!hashString || hashString.length < 2) {
    throw new Error('Must provide a hash');
  }

  if (hashString.substring(0, 2).toLowerCase() !== '0x') {
    throw new Error("Hash must start with '0x'");
  }

  if (hashString.length !== 66) {
    throw new Error(`Invalid hash length of ${hashString.length}, should be 64 hex characters long excluding the '0x' prefix`);
  }

  if (!RegExp('^0[xX][A-Fa-f0-9]+$').test(hashString)) {
    throw new Error('Hash contains non-hexidecimal digits (outside of 0-9 and a-f)');
  }
}

function validateBlockNumOrHash(numOrHash) {
  if (!numOrHash) {
    throw new Error('Must provide a block number or hash');
  }

  // fast return if it's a valid positive integer
  if (isNaturalNumber(numOrHash)) {
    return;
  }

  validateBlockTxHash(numOrHash);
}

function validateDeploymentId(deploymentId) {
  if (deploymentId !== null && !RegExp('^[a-z0-9]+$', 'i').test(deploymentId)) {
    throw new Error('Invalid deployment ID');
  }
}

function validateApiKey(apiKey) {
  // based on: https://www.regextester.com/105777
  // eslint-disable-next-line no-useless-escape
  if (apiKey !== null && !RegExp('^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+\/=]*$').test(apiKey)) {
    throw new Error('Invalid API key');
  }
}
