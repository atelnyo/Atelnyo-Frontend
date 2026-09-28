/**
 * ``Wizard.jsx`` — minimal stub.
 *
 * Legacy enrollment modal that collected WhatsApp contact for the
 * MonCash/NatCash payment flow. Replaced by Phase 32 Stripe-backed
 * the checkout flow mounted inside ``src/App.jsx``. App.jsx still
 * wires this stub to keep the ``isWizardOpen`` toggle valid until the
 * legacy call sites are pruned.
 */
import React from 'react';

function Wizard({ isOpen, _onClose, _selectedCourse, _lang, _translations, _showToast, _onEnrollSuccess }) {
  if (!isOpen) return null;
  return null;
}

export default Wizard;
