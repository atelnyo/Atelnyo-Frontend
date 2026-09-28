/**
 * src/pages/wallet/WalletPage.jsx
 *
 * Standalone wallet page at /sheet/wallet.
 * Mirrors the WalletSection tabbed surface but manages its own
 * withdraw modal state so it doesn't depend on CreatorStudio.
 */
import React, { useState } from 'react';
import WalletSection from '../../components/studio/sections/WalletSection';
import WithdrawModal from '../../components/studio/modals/WithdrawModal';
import VerificationModal from '../../components/studio/modals/VerificationModal';

export default function WalletPage({ lang = 'ht', t = {}, showToast, user }) {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  if (!user) {
    return (
      <div className="wallet-page-gate">
        <i className="fas fa-lock" />
        <h3>{lang === 'ht' ? 'Konekte pou wè bous ou.' : 'Sign in to view your wallet.'}</h3>
      </div>
    );
  }

  return (
    <div className="wallet-page">
      <WalletSection
        lang={lang}
        t={t}
        showToast={showToast}
        setShowWithdrawModal={setShowWithdrawModal}
      />
      {showWithdrawModal && (
        <WithdrawModal
          lang={lang}
          showToast={showToast}
          onClose={() => setShowWithdrawModal(false)}
          onOpenVerification={() => { setShowWithdrawModal(false); setShowVerificationModal(true); }}
        />
      )}
      {showVerificationModal && (
        <VerificationModal
          lang={lang}
          showToast={showToast}
          onClose={() => setShowVerificationModal(false)}
        />
      )}
    </div>
  );
}
