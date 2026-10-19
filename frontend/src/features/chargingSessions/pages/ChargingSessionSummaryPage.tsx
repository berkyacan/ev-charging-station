import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiClientError } from '../../shared/api';
import { PageHero } from '../../shared/components/PageHero';
import { clearToken } from '../../shared/utils/authToken';
import type { PaymentMethod } from '../../shared/types';
import {
  formatChargingSessionStatusLabel,
  formatPaymentMethodLabel,
} from '../../shared/utils/labels';
import { translateUiMessage } from '../../shared/utils/messages';
import {
  confirmChargingSessionPayment,
  getChargingSessionSummary,
  type ChargingSessionPaymentResponse,
  type ChargingSessionSummaryResponse,
} from '../api/chargingSessionsApi';
import {
  getWalletSummary,
  simulateWalletTopUp,
  type WalletSummaryResponse,
  type WalletTopUpResponse,
} from '../../wallet/api/walletApi';

const defaultPaymentMethod: PaymentMethod = 'DEMO_WALLET';
const demoMaskedCard = '**** **** **** 2026';
const topUpPresetAmounts = [100, 250, 500];

export function ChargingSessionSummaryPage(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [summary, setSummary] = useState<ChargingSessionSummaryResponse | null>(null);
  const [walletSummary, setWalletSummary] = useState<WalletSummaryResponse | null>(null);
  const [topUpRecord, setTopUpRecord] = useState<WalletTopUpResponse | null>(null);
  const [topUpAmountInput, setTopUpAmountInput] = useState('250');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPaymentPanelOpen, setIsPaymentPanelOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(defaultPaymentMethod);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [isToppingUp, setIsToppingUp] = useState(false);
  const [showTopUpPanel, setShowTopUpPanel] = useState(false);
  const [paymentErrorMessage, setPaymentErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setErrorMessage('Charging session information not found.');
      setIsLoading(false);
      return;
    }

    void loadSummary(id);
  }, [id]);

  const payableAmount = summary?.totalCost ?? null;
  const paymentRecord = summary?.payment ?? null;
  const walletBalance = walletSummary?.walletBalance ?? null;
  const remainingBalanceAfterPayment = useMemo(() => {
    if (walletBalance === null || payableAmount === null) {
      return null;
    }

    return roundToTwoDecimals(walletBalance - payableAmount);
  }, [payableAmount, walletBalance]);
  const isWalletInsufficient = Boolean(
    paymentMethod === 'DEMO_WALLET' &&
      walletBalance !== null &&
      payableAmount !== null &&
      walletBalance < payableAmount,
  );
  const paymentStatusLabel = isLoading
    ? 'Loading'
    : paymentRecord
      ? 'Paid'
      : isConfirmingPayment
        ? 'Processing'
        : 'Pending';
  const paymentStatusHint = paymentRecord
    ? paymentRecord.receiptNumber
    : 'Awaiting payment confirmation';

  async function loadSummary(sessionId: string): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);
    setPaymentErrorMessage(null);

    try {
      const [summaryResponse, walletResponse] = await Promise.all([
        getChargingSessionSummary(sessionId),
        getWalletSummary(),
      ]);

      setSummary(summaryResponse);
      setWalletSummary(walletResponse);
      setTopUpRecord(null);
      setTopUpAmountInput('250');
      setShowTopUpPanel(false);
      setIsPaymentPanelOpen(false);
      setPaymentMethod(defaultPaymentMethod);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }

      setErrorMessage(resolveSummaryError(error));
      setSummary(null);
      setWalletSummary(null);
    } finally {
      setIsLoading(false);
    }
  }

  function openPaymentPanel(): void {
    setPaymentMethod(defaultPaymentMethod);
    setPaymentErrorMessage(null);
    setShowTopUpPanel(false);
    setTopUpRecord(null);
    setTopUpAmountInput('250');
    setIsPaymentPanelOpen(true);
  }

  async function handleConfirmPayment(): Promise<void> {
    if (!summary || payableAmount === null) {
      return;
    }

    if (paymentMethod === 'DEMO_WALLET' && isWalletInsufficient) {
      setPaymentErrorMessage('Insufficient wallet balance. Please top up your wallet.');
      setShowTopUpPanel(true);
      return;
    }

    setIsConfirmingPayment(true);
    setPaymentErrorMessage(null);

    try {
      const [paymentResponse] = await Promise.all([
        confirmChargingSessionPayment(summary.id, {
          paymentMethod,
        }),
        wait(900),
      ]);

      applyPaymentToScreen(paymentResponse);
      setIsPaymentPanelOpen(false);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }

      setPaymentErrorMessage(resolvePaymentError(error));

      if (error instanceof ApiClientError && error.message.includes('Insufficient wallet balance')) {
        setShowTopUpPanel(true);
      }
    } finally {
      setIsConfirmingPayment(false);
    }
  }

  async function handleTopUp(): Promise<void> {
    const parsedAmount = Number(topUpAmountInput);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setPaymentErrorMessage('Enter a valid top-up amount.');
      setShowTopUpPanel(true);
      return;
    }

    setIsToppingUp(true);
    setPaymentErrorMessage(null);

    try {
      const [topUpResponse] = await Promise.all([
        simulateWalletTopUp({
          amount: parsedAmount,
        }),
        wait(700),
      ]);

      setWalletSummary((currentWallet) => ({
        walletBalance: topUpResponse.walletBalanceAfterTopUp,
        currencyCode: currentWallet?.currencyCode ?? 'TRY',
        updatedAt: topUpResponse.toppedUpAt,
      }));
      setTopUpRecord(topUpResponse);
      setShowTopUpPanel(true);

      if (
        payableAmount !== null &&
        topUpResponse.walletBalanceAfterTopUp >= payableAmount
      ) {
        setPaymentErrorMessage(null);
      }
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        clearToken();
        navigate('/login', { replace: true });
        return;
      }

      setPaymentErrorMessage(resolveTopUpError(error));
      setShowTopUpPanel(true);
    } finally {
      setIsToppingUp(false);
    }
  }

  function applyPaymentToScreen(
    paymentResponse: ChargingSessionPaymentResponse,
  ): void {
    setSummary((currentSummary) =>
      currentSummary
        ? {
            ...currentSummary,
            payment: paymentResponse,
          }
        : currentSummary,
    );

    if (paymentResponse.walletBalanceAfterPayment !== null) {
      setWalletSummary((currentWallet) => ({
        walletBalance: paymentResponse.walletBalanceAfterPayment ?? 0,
        currencyCode: currentWallet?.currencyCode ?? 'TRY',
        updatedAt: paymentResponse.paidAt,
      }));
    }
  }

  return (
    <section className="page-shell">
      <PageHero
        actions={
          <>
            <Link className="secondary-button secondary-button--link" to="/reservations/new">
              New Reservation
            </Link>
            <Link className="secondary-button secondary-button--link" to="/charging-sessions">
              Back to Sessions
            </Link>
            <Link className="secondary-button secondary-button--link" to="/history">
              Open Session History
            </Link>
          </>
        }
        badge="Payment confirmation"
        description="Review the charging cost breakdown, wallet balance, and digital receipt for the completed session."
        eyebrow="Charging Session Summary"
        metrics={[
          {
            label: 'Status',
            value: isLoading ? 'Loading' : summary ? toStatusLabel(summary.status) : 'Unavailable',
            hint: 'Current session status',
          },
          {
            label: 'Energy Consumed',
            value: isLoading
              ? 'Loading'
              : formatMetricValue(summary?.consumedKWh, 'kWh'),
            hint: 'Energy consumed during session',
          },
          {
            label: 'Total Amount',
            value: isLoading
              ? 'Loading'
              : formatMetricValue(summary?.totalCost, 'TL'),
            hint: 'Calculated payment amount',
          },
          {
            label: 'Payment',
            value: paymentStatusLabel,
            hint: paymentStatusHint,
          },
        ]}
        title="Charging Session Summary"
      />

      <div className="card">
        <div className="helper-card helper-card--split">
          <div>
            <span className="helper-card__eyebrow">Wallet and Payment</span>
            <h2>Consumption, payment confirmation, and digital receipt in one workspace</h2>
            <p>Review completed charging session cost, wallet balance, and payment confirmation from one panel.</p>
            <div className="helper-card__specs">
              <span className="helper-chip">Consumed kWh</span>
              <span className="helper-chip">Wallet balance</span>
              <span className="helper-chip">Total amount</span>
              <span className="helper-chip">Digital receipt</span>
            </div>
          </div>
          <div className="reservation-actions">
            <Link className="secondary-button secondary-button--link" to="/reservations/new">
              New Reservation
            </Link>
            <Link className="secondary-button secondary-button--link" to="/charging-sessions">
              Back to Charging Sessions
            </Link>
            <Link className="secondary-button secondary-button--link" to="/dashboard">
              Back to Overview
            </Link>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="message-banner message-banner--error" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {isLoading ? (
        <section className="card">
          <div
            aria-live="polite"
            className="session-empty-state session-empty-state--loading"
            role="status"
          >
            <span className="session-empty-state__eyebrow">Loading</span>
            <strong>Preparing charging session summary</strong>
            <p>Wallet balance, ödeme detayları ve nihai tutar yükleniyor.</p>
          </div>
        </section>
      ) : summary ? (
        <div className="page-grid page-grid--route">
          <section className="card session-receipt">
            <div className="section-heading">
              <div>
                <h2>Charging Cost Breakdown</h2>
                <p>Station, charger, meter readings, and total amount in one view.</p>
              </div>
              <span className="status-pill status-pill--completed">
                {toStatusLabel(summary.status)}
              </span>
            </div>

            <div className="session-receipt__hero">
              <div>
                <span className="session-receipt__label">Total Amount</span>
                <strong>{formatMetricValue(summary.totalCost, 'TL')}</strong>
                <p>
                  {formatNullableNumber(summary.consumedKWh)} kWh x{' '}
                  {formatNumber(summary.pricePerKWh)} TL/kWh
                </p>
              </div>
            </div>

            <div className="session-receipt__grid">
              <article className="session-receipt__metric">
                <span>Station</span>
                <strong>{summary.station.name}</strong>
              </article>
              <article className="session-receipt__metric">
                <span>Charger</span>
                <strong>{summary.charger.label}</strong>
              </article>
              <article className="session-receipt__metric">
                <span>Start Energy</span>
                <strong>{formatMetricValue(summary.startEnergyKWh, 'kWh')}</strong>
              </article>
              <article className="session-receipt__metric">
                <span>End Energy</span>
                <strong>{formatMetricValue(summary.endEnergyKWh, 'kWh')}</strong>
              </article>
              <article className="session-receipt__metric">
                <span>Consumed kWh</span>
                <strong>{formatMetricValue(summary.consumedKWh, 'kWh')}</strong>
              </article>
              <article className="session-receipt__metric">
                <span>Unit Price</span>
                <strong>{formatNumber(summary.pricePerKWh)} TL/kWh</strong>
              </article>
            </div>

            <div className="session-cost-breakdown">
              <div className="session-cost-breakdown__row">
                <span>Station Address</span>
                <strong>{summary.station.address}</strong>
              </div>
              <div className="session-cost-breakdown__row">
                <span>Charger Profile</span>
                <strong>
                  {summary.charger.connectorType} / {formatNumber(summary.charger.powerOutputKW)} kW
                </strong>
              </div>
              <div className="session-cost-breakdown__row">
                <span>Consumed energy</span>
                <strong>{formatNullableNumber(summary.consumedKWh)} kWh</strong>
              </div>
              <div className="session-cost-breakdown__row">
                <span>Unit price</span>
                <strong>{formatNumber(summary.pricePerKWh)} TL/kWh</strong>
              </div>
              <div className="session-cost-breakdown__row session-cost-breakdown__row--total">
                <span>Total amount</span>
                <strong>{formatNullableNumber(summary.totalCost)} TL</strong>
              </div>
            </div>

            <div className="payment-handoff">
              <div>
                <span className="payment-handoff__eyebrow">Payment</span>
                <strong>Payment confirmationna geçin</strong>
                <p>Review the charging session summary, then confirm payment.</p>
              </div>
              {paymentRecord ? (
                <span className="status-pill status-pill--completed">Paid</span>
              ) : (
                <button
                  className="primary-button"
                  onClick={openPaymentPanel}
                  type="button"
                >
                  Proceed to Payment
                </button>
              )}
            </div>
          </section>

          <div className="page-stack">
            <section className="card payment-flow-card">
              <div className="section-heading">
                <div>
                  <h2>Wallet and Payment</h2>
                  <p>Wallet balanceni kontrol edin, gerekirse bakiye yükleyin ve ödemeyi tamamlayın.</p>
                </div>
                <span
                  className={`status-pill ${
                    paymentRecord
                      ? 'status-pill--completed'
                      : isConfirmingPayment
                        ? 'status-pill--occupied'
                        : 'status-pill--confirmed'
                  }`}
                >
                  {paymentRecord
                    ? 'Paid'
                    : isConfirmingPayment
                      ? 'Processing'
                      : 'Pending'}
                </span>
              </div>

              {paymentRecord ? (
                <div className="payment-success-stack">
                  <div className="payment-status-banner payment-status-banner--success">
                    <span className="payment-status-banner__eyebrow">Payment Successful</span>
                    <strong>Payment Successful</strong>
                    <p>Payment record created and digital receipt prepared.</p>
                  </div>

                  <div className="payment-confirmation-grid">
                    <article className="payment-confirmation-card">
                      <span>Amount Paid</span>
                      <strong>{formatNullableNumber(paymentRecord.paidAmount)} TL</strong>
                    </article>
                    <article className="payment-confirmation-card">
                      <span>Transaction ID</span>
                      <strong>{paymentRecord.transactionId}</strong>
                    </article>
                    <article className="payment-confirmation-card">
                      <span>Receipt Number</span>
                      <strong>{paymentRecord.receiptNumber}</strong>
                    </article>
                    <article className="payment-confirmation-card">
                      <span>Payment Method</span>
                      <strong>{toPaymentMethodLabel(paymentRecord.paymentMethod)}</strong>
                    </article>
                    <article className="payment-confirmation-card">
                      <span>Payment Time</span>
                      <strong>{formatDateTime(paymentRecord.paidAt)}</strong>
                    </article>
                    <article className="payment-confirmation-card">
                      <span>Remaining Balance</span>
                      <strong>
                        {paymentRecord.paymentMethod === 'DEMO_WALLET'
                          ? formatWalletAmount(paymentRecord.walletBalanceAfterPayment)
                          : 'Wallet not used'}
                      </strong>
                    </article>
                  </div>
                </div>
              ) : isConfirmingPayment ? (
                <div
                  aria-live="polite"
                  className="payment-processing"
                  role="status"
                >
                  <span className="payment-processing__eyebrow">Payment</span>
                  <strong>Processing payment...</strong>
                  <p>
                    {toPaymentMethodLabel(paymentMethod)} payment completing while receipt is being prepared.
                  </p>
                </div>
              ) : isPaymentPanelOpen ? (
                <div className="payment-panel">
                  {paymentErrorMessage ? (
                    <div className="message-banner message-banner--error" role="alert">
                      {paymentErrorMessage}
                    </div>
                  ) : null}

                  <div className="payment-method-grid">
                    <label
                      className={`payment-method-card ${
                        paymentMethod === 'DEMO_WALLET'
                          ? 'payment-method-card--selected'
                          : ''
                      }`}
                    >
                      <input
                        checked={paymentMethod === 'DEMO_WALLET'}
                        name="paymentMethod"
                        onChange={() => setPaymentMethod('DEMO_WALLET')}
                        type="radio"
                      />
                      <span className="payment-method-card__eyebrow">Payment Method</span>
                      <strong>Wallet</strong>
                      <p>Wallet balance: {formatWalletAmount(walletBalance)}</p>
                    </label>

                    <label
                      className={`payment-method-card ${
                        paymentMethod === 'DEMO_CARD'
                          ? 'payment-method-card--selected'
                          : ''
                      }`}
                    >
                      <input
                        checked={paymentMethod === 'DEMO_CARD'}
                        name="paymentMethod"
                        onChange={() => setPaymentMethod('DEMO_CARD')}
                        type="radio"
                      />
                      <span className="payment-method-card__eyebrow">Payment Method</span>
                      <strong>Registered Card</strong>
                      <p>{demoMaskedCard}</p>
                    </label>
                  </div>

                  <div className="payment-breakdown-grid">
                    <article className="payment-breakdown-card">
                      <span>Wallet Balance</span>
                      <strong>{formatWalletAmount(walletBalance)}</strong>
                    </article>
                    <article className="payment-breakdown-card">
                      <span>Amount to Pay</span>
                      <strong>{formatMetricValue(summary.totalCost, 'TL')}</strong>
                    </article>
                    <article className="payment-breakdown-card">
                      <span>Payment Sonrası Remaining Balance</span>
                      <strong>
                        {paymentMethod === 'DEMO_WALLET'
                          ? formatWalletAmount(remainingBalanceAfterPayment)
                          : 'Card payment'}
                      </strong>
                    </article>
                    <article className="payment-breakdown-card">
                      <span>Selected Method</span>
                      <strong>{paymentMethod === 'DEMO_WALLET' ? 'Wallet' : 'Registered Card'}</strong>
                    </article>
                  </div>

                  {(showTopUpPanel || isWalletInsufficient) && paymentMethod === 'DEMO_WALLET' ? (
                    <div className="wallet-top-up-panel">
                      <div className="wallet-top-up-panel__header">
                        <div>
                          <span className="wallet-top-up-panel__eyebrow">Wallet</span>
                          <strong>Top Up</strong>
                          <p>Wallet balanceni artırın ve ödeme adımına devam edin.</p>
                        </div>
                        <span className="status-pill status-pill--occupied">
                          {isWalletInsufficient ? 'Insufficient Balance' : 'Ready to Top Up'}
                        </span>
                      </div>

                      <div className="wallet-top-up-panel__presets">
                        {topUpPresetAmounts.map((amount) => (
                          <button
                            className={`secondary-button secondary-button--link ${
                              topUpAmountInput === String(amount) ? 'wallet-top-up-chip--selected' : ''
                            }`}
                            key={amount}
                            onClick={() => setTopUpAmountInput(String(amount))}
                            type="button"
                          >
                            {amount} TL
                          </button>
                        ))}
                      </div>

                      <div className="wallet-top-up-panel__form">
                        <label className="field-label" htmlFor="walletTopUpAmount">
                          Top-up Amount
                        </label>
                        <input
                          className="text-input"
                          id="walletTopUpAmount"
                          inputMode="decimal"
                          min="1"
                          onChange={(event) => setTopUpAmountInput(event.target.value)}
                          placeholder="250"
                          type="number"
                          value={topUpAmountInput}
                        />
                      </div>

                      {topUpRecord ? (
                        <div className="message-banner message-banner--success" role="status">
                          <strong>Balance topped up</strong>
                          <span>
                            {formatNumber(topUpRecord.topUpAmount)} TL added. Current balance{' '}
                            {formatNumber(topUpRecord.walletBalanceAfterTopUp)} TL.
                          </span>
                        </div>
                      ) : null}

                      <div className="reservation-actions">
                        <button
                          className="secondary-button"
                          disabled={isToppingUp}
                          onClick={() => void handleTopUp()}
                          type="button"
                        >
                          {isToppingUp ? 'Topping up...' : 'Top Up'}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="reservation-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setIsPaymentPanelOpen(false)}
                      type="button"
                    >
                      Back
                    </button>
                    <button
                      className="primary-button"
                      disabled={isConfirmingPayment || payableAmount === null}
                      onClick={() => void handleConfirmPayment()}
                      type="button"
                    >
                      {paymentMethod === 'DEMO_WALLET' ? 'Pay with Wallet' : 'Pay with Registered Card'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="payment-ready-state">
                  <span className="payment-ready-state__eyebrow">Payment</span>
                  <strong>Payment step ready</strong>
                  <p>Wallet balanceni kontrol edin veya kayıtlı kartla devam edin.</p>
                  <div className="payment-ready-state__meta">
                    <span>{formatWalletAmount(walletBalance)}</span>
                    <span>{formatMetricValue(summary.totalCost, 'TL')}</span>
                    <span>Pending</span>
                  </div>
                  <div className="reservation-actions">
                    <button
                      className="primary-button"
                      onClick={openPaymentPanel}
                      type="button"
                    >
                      Proceed to Payment
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="card">
              <div className="section-heading">
                <div>
                  <h2>Digital Receipt</h2>
                  <p>Session and payment summary stored here when payment is complete.</p>
                </div>
              </div>

              {paymentRecord ? (
                <div className="digital-receipt">
                  <div className="digital-receipt__header">
                    <div>
                      <span className="digital-receipt__eyebrow">Digital Receipt</span>
                      <h3>Payment and Session Summary</h3>
                    </div>
                    <span className="status-pill status-pill--available">Confirmed</span>
                  </div>

                  <div className="digital-receipt__grid">
                    <article className="digital-receipt__card">
                      <span>Station</span>
                      <strong>{summary.station.name}</strong>
                      <p>{summary.station.address}</p>
                    </article>
                    <article className="digital-receipt__card">
                      <span>Charger</span>
                      <strong>{summary.charger.label}</strong>
                      <p>
                        {summary.charger.connectorType} / {formatNumber(summary.charger.powerOutputKW)} kW
                      </p>
                    </article>
                    <article className="digital-receipt__card">
                      <span>Energy Consumed</span>
                      <strong>{formatMetricValue(summary.consumedKWh, 'kWh')}</strong>
                      <p>
                        {formatMetricValue(summary.startEnergyKWh, 'kWh')} {'->'}{' '}
                        {formatMetricValue(summary.endEnergyKWh, 'kWh')}
                      </p>
                    </article>
                    <article className="digital-receipt__card">
                      <span>Payment Method</span>
                      <strong>{toPaymentMethodLabel(paymentRecord.paymentMethod)}</strong>
                      <p>
                        {paymentRecord.paymentMethod === 'DEMO_CARD'
                          ? demoMaskedCard
                          : 'Wallet payment completed'}
                      </p>
                    </article>
                    <article className="digital-receipt__card">
                      <span>Unit Price</span>
                      <strong>{formatNumber(summary.pricePerKWh)} TL/kWh</strong>
                      <p>Applied rate</p>
                    </article>
                    <article className="digital-receipt__card">
                      <span>Total Amount</span>
                      <strong>{formatNullableNumber(paymentRecord.paidAmount)} TL</strong>
                      <p>{formatDateTime(paymentRecord.paidAt)}</p>
                    </article>
                    <article className="digital-receipt__card">
                      <span>Transaction ID</span>
                      <strong>{paymentRecord.transactionId}</strong>
                      <p>{paymentRecord.receiptNumber}</p>
                    </article>
                  </div>
                </div>
              ) : (
                <div className="session-empty-state">
                  <span className="session-empty-state__eyebrow">Receipt</span>
                  <strong>Digital receipt will be shown here when payment is complete</strong>
                  <p>Receipt oluşturmak için önce cüzdan veya kayıtlı kart ile ödemeyi tamamlayın.</p>
                </div>
              )}
            </section>

            <section className="card">
              <div className="section-heading">
                <div>
                  <h2>Session Details</h2>
                  <p>Review charging target, energy values, and record details on one screen.</p>
                </div>
              </div>

              <div className="session-asset-grid">
                <article className="session-asset-card">
                  <span>Station</span>
                  <strong>{summary.station.name}</strong>
                  <p>{summary.station.address}</p>
                </article>
                <article className="session-asset-card">
                  <span>Charger</span>
                  <strong>{summary.charger.label}</strong>
                  <p>
                    {summary.charger.connectorType} / {formatNumber(summary.charger.powerOutputKW)} kW
                  </p>
                </article>
              </div>

              <div className="session-record-grid">
                <article className="session-record-card">
                  <span>Session Status</span>
                  <strong>{toStatusLabel(summary.status)}</strong>
                </article>
                <article className="session-record-card">
                  <span>Session Time</span>
                  <strong>{formatDateTime(summary.createdAt)}</strong>
                </article>
                <article className="session-record-card">
                  <span>Start Energy</span>
                  <strong>{formatMetricValue(summary.startEnergyKWh, 'kWh')}</strong>
                </article>
                <article className="session-record-card">
                  <span>End Energy</span>
                  <strong>{formatMetricValue(summary.endEnergyKWh, 'kWh')}</strong>
                </article>
                <article className="session-record-card">
                  <span>Energy Consumed</span>
                  <strong>{formatMetricValue(summary.consumedKWh, 'kWh')}</strong>
                </article>
                <article className="session-record-card">
                  <span>Wallet Balance</span>
                  <strong>{formatWalletAmount(walletBalance)}</strong>
                </article>
              </div>

            </section>
          </div>
        </div>
      ) : (
        <section className="card">
          <div className="session-empty-state">
            <span className="session-empty-state__eyebrow">Unavailable</span>
            <strong>Charging session summary not found</strong>
            <p>Return to Charging Sessions and complete a session to generate a payment summary.</p>
          </div>
        </section>
      )}
    </section>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'Bekleniyor' : formatNumber(value);
}

function formatMetricValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) {
    return 'Bekleniyor';
  }

  return `${formatNumber(value)} ${unit}`;
}

function formatWalletAmount(value: number | null): string {
  if (value === null) {
    return 'Bekleniyor';
  }

  if (value < 0) {
    return `${formatNumber(0)} TL`;
  }

  return `${formatNumber(value)} TL`;
}

function resolveSummaryError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return translateUiMessage(error.message);
  }

  return 'Charging session summary is currently unavailable.';
}

function toStatusLabel(status: string): string {
  return formatChargingSessionStatusLabel(status);
}

function toPaymentMethodLabel(method: PaymentMethod): string {
  return formatPaymentMethodLabel(method);
}

function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function resolvePaymentError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return translateUiMessage(error.message);
  }

  return 'Payment confirmation is currently unavailable.';
}

function resolveTopUpError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return translateUiMessage(error.message);
  }

  return 'Wallet top-up is currently unavailable.';
}
