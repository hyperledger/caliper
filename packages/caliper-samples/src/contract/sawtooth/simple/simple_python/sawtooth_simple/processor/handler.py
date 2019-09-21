# Copyright 2016 Intel Corporation
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ------------------------------------------------------------------------------

import logging
import hashlib

import cbor

from sawtooth_sdk.processor.handler import TransactionHandler
from sawtooth_sdk.processor.exceptions import InvalidTransaction
from sawtooth_sdk.processor.exceptions import InternalError


LOGGER = logging.getLogger(__name__)


VALID_VERBS = 'open', 'delete', 'query', 'transfer'

MIN_VALUE = 0
MAX_VALUE = 4294967295
MAX_NAME_LENGTH = 20

FAMILY_NAME = 'simple'

SIMPLE_ADDRESS_PREFIX = hashlib.sha512(
    FAMILY_NAME.encode('utf-8')).hexdigest()[0:6]


def make_simple_address(name):
    return SIMPLE_ADDRESS_PREFIX + hashlib.sha512(
        name.encode('utf-8')).hexdigest()[-64:]


class SimpleTransactionHandler(TransactionHandler):
    @property
    def family_name(self):
        return FAMILY_NAME

    @property
    def family_versions(self):
        return ['1.0']

    @property
    def namespaces(self):
        return [SIMPLE_ADDRESS_PREFIX]

    def apply(self, transaction, context):
        verb, name, value = _unpack_transaction(transaction)

        state = _get_state_data(name, context)

        updated_state = _do_simple(verb, name, value, state)

        _set_state_data(name, updated_state, context)


def _unpack_transaction(transaction):
    verb, name, value = _decode_transaction(transaction)

    _validate_verb(verb)
    _validate_name(name)
    _validate_value(value)

    return verb, name, value


def _decode_transaction(transaction):
    try:
        content = cbor.loads(transaction.payload)
    except:
        raise InvalidTransaction(
            'Invalid payload serialization')

    try:
        verb = content['verb']
    except AttributeError:
        raise InvalidTransaction('Verb is required')

    try:
        name = content['account']
    except AttributeError:
        raise InvalidTransaction('Name is required')

    try:
        value = int(content['money'])

    except AttributeError:
        raise InvalidTransaction('Value is required')

    return verb, name, value


def _validate_verb(verb):
    if verb not in VALID_VERBS:
        raise InvalidTransaction(
            'Verb must be "open", "delete", "query", or "transfer"')


def _validate_name(name):
    if not isinstance(name, str) or len(name) > MAX_NAME_LENGTH:
        raise InvalidTransaction(
            'Name must be a string of no more than {} characters'.format(
                MAX_NAME_LENGTH))


def _validate_value(value):
    if not isinstance(value, int) or value < 0 or value > MAX_VALUE:
        raise InvalidTransaction(
            'Value must be an integer '
            'no less than {i} and no greater than {a}'.format(
                i=MIN_VALUE,
                a=MAX_VALUE))


def _get_state_data(name, context):
    address = make_simple_address(name)

    state_entries = context.get_state([address])

    try:
        return cbor.loads(state_entries[0].data)
    except IndexError:
        return {}
    except:
        raise InternalError(
            'Failed to load state data')


def _set_state_data(name, state, context):
    address = make_simple_address(name)

    encoded = cbor.dumps(state)

    addresses = context.set_state({address: encoded})

    if not addresses:
        raise InternalError(
            'State error')


def _do_simple(verb, name, value, state):
    verbs = {
        'open': _do_open,
        'delete': _do_delete,
        'query': _do_query,
        'transfer': _do_transfer,
    }

    try:
        return verbs[verb](name, value, state)
    except KeyError:
        # This would be a programming error.
        raise InternalError(
            'Unhandled verb: {}'.format(verb))


def _do_open(name, value, state):
    msg = 'Opening "{n}" to {v}'.format(n=name, v=value)
    LOGGER.debug(msg)

    if name in state:
        raise InvalidTransaction(
            'Account is "open", but already exists: Name: {n}, Value {v}'.format(
                n=name,
                v=state[name]))

    updated = {k: v for k, v in state.items()}
    updated[name] = value

    return updated


def _do_delete(name, value, state):
    msg = 'Incrementing "{n}" by {v}'.format(n=name, v=value)
    LOGGER.debug(msg)

    if name not in state:
        raise InvalidTransaction(
            'Verb is "inc" but name "{}" not in state'.format(name))

    curr = state[name]
    incd = curr + value

    if incd > MAX_VALUE:
        raise InvalidTransaction(
            'Verb is "inc", but result would be greater than {}'.format(
                MAX_VALUE))

    updated = {k: v for k, v in state.items()}
    updated[name] = incd

    return updated

def _do_query(name, value, state):
    return


def _do_transfer(name, value, state):
    msg = 'Decrementing "{n}" by {v}'.format(n=name, v=value)
    LOGGER.debug(msg)

    if name not in state:
        raise InvalidTransaction(
            'Verb is "dec" but name "{}" not in state'.format(name))

    curr = state[name]
    decd = curr - value

    if decd < MIN_VALUE:
        raise InvalidTransaction(
            'Verb is "dec", but result would be less than {}'.format(
                MIN_VALUE))

    updated = {k: v for k, v in state.items()}
    updated[name] = decd

    return updated
