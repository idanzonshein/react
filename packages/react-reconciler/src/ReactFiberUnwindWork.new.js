/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {Fiber} from './ReactInternalTypes';
import type {ExpirationTimeOpaque} from './ReactFiberExpirationTime.new';
import type {SuspenseState} from './ReactFiberSuspenseComponent.new';

import {resetWorkInProgressVersions as resetMutableSourceWorkInProgressVersions} from './ReactMutableSource.new';
import {
  ClassComponent,
  HostRoot,
  HostComponent,
  HostPortal,
  ContextProvider,
  SuspenseComponent,
  SuspenseListComponent,
} from './ReactWorkTags';
import {DidCapture, NoEffect, ShouldCapture} from './ReactSideEffectTags';
import {enableSuspenseServerRenderer} from 'shared/ReactFeatureFlags';

import {popHostContainer, popHostContext} from './ReactFiberHostContext.new';
import {popSuspenseContext} from './ReactFiberSuspenseContext.new';
import {resetHydrationState} from './ReactFiberHydrationContext.new';
import {
  isContextProvider as isLegacyContextProvider,
  popContext as popLegacyContext,
  popTopLevelContextObject as popTopLevelLegacyContextObject,
} from './ReactFiberContext.new';
import {popProvider} from './ReactFiberNewContext.new';

import invariant from 'shared/invariant';

function unwindWork(
  workInProgress: Fiber,
  renderExpirationTime: ExpirationTimeOpaque,
) {
  switch (workInProgress.tag) {
    case ClassComponent: {
      const Component = workInProgress.type;
      if (isLegacyContextProvider(Component)) {
        popLegacyContext(workInProgress);
      }
      const effectTag = workInProgress.effectTag;
      if (effectTag & ShouldCapture) {
        workInProgress.effectTag = (effectTag & ~ShouldCapture) | DidCapture;
        return workInProgress;
      }
      return null;
    }
    case HostRoot: {
      popHostContainer(workInProgress);
      popTopLevelLegacyContextObject(workInProgress);
      resetMutableSourceWorkInProgressVersions();
      const effectTag = workInProgress.effectTag;
      invariant(
        (effectTag & DidCapture) === NoEffect,
        'The root failed to unmount after an error. This is likely a bug in ' +
          'React. Please file an issue.',
      );
      workInProgress.effectTag = (effectTag & ~ShouldCapture) | DidCapture;
      return workInProgress;
    }
    case HostComponent: {
      // TODO: popHydrationState
      popHostContext(workInProgress);
      return null;
    }
    case SuspenseComponent: {
      popSuspenseContext(workInProgress);
      if (enableSuspenseServerRenderer) {
        const suspenseState: null | SuspenseState =
          workInProgress.memoizedState;
        if (suspenseState !== null && suspenseState.dehydrated !== null) {
          invariant(
            workInProgress.alternate !== null,
            'Threw in newly mounted dehydrated component. This is likely a bug in ' +
              'React. Please file an issue.',
          );
          resetHydrationState();
        }
      }
      const effectTag = workInProgress.effectTag;
      if (effectTag & ShouldCapture) {
        workInProgress.effectTag = (effectTag & ~ShouldCapture) | DidCapture;
        // Captured a suspense effect. Re-render the boundary.
        return workInProgress;
      }
      return null;
    }
    case SuspenseListComponent: {
      popSuspenseContext(workInProgress);
      // SuspenseList doesn't actually catch anything. It should've been
      // caught by a nested boundary. If not, it should bubble through.
      return null;
    }
    case HostPortal:
      popHostContainer(workInProgress);
      return null;
    case ContextProvider:
      popProvider(workInProgress);
      return null;
    default:
      return null;
  }
}

function unwindInterruptedWork(interruptedWork: Fiber) {
  switch (interruptedWork.tag) {
    case ClassComponent: {
      const childContextTypes = interruptedWork.type.childContextTypes;
      if (childContextTypes !== null && childContextTypes !== undefined) {
        popLegacyContext(interruptedWork);
      }
      break;
    }
    case HostRoot: {
      popHostContainer(interruptedWork);
      popTopLevelLegacyContextObject(interruptedWork);
      resetMutableSourceWorkInProgressVersions();
      break;
    }
    case HostComponent: {
      popHostContext(interruptedWork);
      break;
    }
    case HostPortal:
      popHostContainer(interruptedWork);
      break;
    case SuspenseComponent:
      popSuspenseContext(interruptedWork);
      break;
    case SuspenseListComponent:
      popSuspenseContext(interruptedWork);
      break;
    case ContextProvider:
      popProvider(interruptedWork);
      break;
    default:
      break;
  }
}

export {unwindWork, unwindInterruptedWork};
