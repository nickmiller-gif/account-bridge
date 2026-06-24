import type { ProviderId } from './types.js';

export class AccountBridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountBridgeError';
  }
}

export class InvalidCredentialError extends AccountBridgeError {
  readonly providerId: ProviderId;

  constructor(providerId: ProviderId, message: string) {
    super(message);
    this.name = 'InvalidCredentialError';
    this.providerId = providerId;
  }
}

export class ProviderUnavailableError extends AccountBridgeError {
  readonly providerId: ProviderId;

  constructor(providerId: ProviderId) {
    super(`Provider "${providerId}" is not registered`);
    this.name = 'ProviderUnavailableError';
    this.providerId = providerId;
  }
}

export class StorageError extends AccountBridgeError {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class FeatureLockedError extends AccountBridgeError {
  readonly providerId: ProviderId;

  constructor(providerId: ProviderId) {
    super(`Feature requires connected provider: ${providerId}`);
    this.name = 'FeatureLockedError';
    this.providerId = providerId;
  }
}

export class NotConnectedError extends AccountBridgeError {
  readonly providerId: ProviderId;

  constructor(providerId: ProviderId) {
    super(`No credentials stored for provider: ${providerId}`);
    this.name = 'NotConnectedError';
    this.providerId = providerId;
  }
}

/** Consumer has not connected provider credentials — feature must stay locked. */
export class ConsumerCreditsRequiredError extends AccountBridgeError {
  readonly providerId?: ProviderId;

  constructor(message: string, providerId?: ProviderId) {
    super(message);
    this.name = 'ConsumerCreditsRequiredError';
    this.providerId = providerId;
  }
}

/** Wallet balance insufficient or wallet funding unavailable. */
export class ConsumerFundingRequiredError extends AccountBridgeError {
  readonly code = 'insufficient_credits' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ConsumerFundingRequiredError';
  }
}
