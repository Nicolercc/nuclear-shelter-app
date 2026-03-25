import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

export const DISCLAIMER_STORAGE_KEY = "nuclear-escape-disclaimer-accepted";
const STORAGE_KEY = DISCLAIMER_STORAGE_KEY;

interface DisclaimerModalProps {
  onAccept?: () => void;
}

export function DisclaimerModal({ onAccept }: DisclaimerModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      setOpen(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, "true");
    setOpen(false);
    onAccept?.();
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="disclaimer-title"
    >
      <div className="relative bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col text-foreground">
        {/* Header */}
        <div className="flex-none px-6 pt-6 pb-4 border-b border-border">
          <h2
            id="disclaimer-title"
            className="flex items-center gap-2 text-xl font-bold text-foreground"
          >
            <span className="text-2xl">⚠</span>
            Important Disclaimer — Please Read
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            You must acknowledge and accept these terms before using this application.
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-sm leading-relaxed">
          <div className="rounded-lg border border-yellow-800 bg-yellow-950/30 p-4">
            <p className="font-bold text-yellow-400 mb-1">FOR EDUCATIONAL AND PREPAREDNESS PLANNING ONLY</p>
            <p className="text-yellow-200/80">
              Nuclear Escape Router is a simulation and educational tool designed for general
              public awareness and emergency preparedness planning. It is not an official
              emergency management system and is not endorsed by any government agency.
            </p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">No Liability for Decisions</p>
            <p className="text-muted-foreground">
              The developers, contributors, and operators of this application accept no
              responsibility or liability for any decisions made, actions taken, or harm
              resulting from the use of or reliance on the information provided by this tool.
              Never use this application as your sole source of guidance during an actual
              emergency.
            </p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Third-Party Data — No Accuracy Guarantee</p>
            <p className="text-muted-foreground">
              This application uses data from third-party services including{" "}
              <span className="text-foreground font-medium">OpenWeather</span> for wind and
              weather conditions, and{" "}
              <span className="text-foreground font-medium">Google Maps</span> for geocoding
              and routing. The accuracy, completeness, timeliness, or fitness for purpose of
              this data is not guaranteed. Weather data, geocoded addresses, and routing
              information may be delayed, incorrect, or unavailable at any given time.
              We make no representations about the accuracy of blast radius estimates, shelter
              information, or any other data displayed.
            </p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">Simulated Data and Approximations</p>
            <p className="text-muted-foreground">
              Blast radius calculations are simplified approximations based on publicly
              available models and are not derived from classified or official government
              sources. Shelter information, capacity figures, and depth ratings are
              approximations and may not reflect current conditions. Escape routes are
              algorithmically generated and do not account for real-time road conditions,
              infrastructure damage, or official evacuation orders.
            </p>
          </div>

          <div className="rounded-lg border border-red-900 bg-red-950/30 p-4">
            <p className="font-bold text-red-400 mb-2">IN A REAL EMERGENCY</p>
            <ul className="space-y-1.5 text-red-200/80">
              <li className="flex gap-2">
                <span className="flex-none text-red-400">•</span>
                <span>
                  Follow instructions from{" "}
                  <strong className="text-red-300">NYC Office of Emergency Management (NYC OEM)</strong>{" "}
                  at nyc.gov/emergency
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-none text-red-400">•</span>
                <span>
                  Follow guidance from{" "}
                  <strong className="text-red-300">FEMA</strong> at ready.gov and on official
                  emergency broadcast channels
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-none text-red-400">•</span>
                <span>
                  Tune to AM radio, TV, or Wireless Emergency Alerts (WEA) on your phone for
                  official instructions
                </span>
              </li>
              <li className="flex gap-2">
                <span className="flex-none text-red-400">•</span>
                <span>
                  Call <strong className="text-red-300">911</strong> only for life-threatening
                  emergencies — do not call to ask for evacuation advice
                </span>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">NYC Emergency Law Context</p>
            <p className="text-muted-foreground">
              New York City has specific emergency laws and protocols governing public response
              to radiological, nuclear, and other mass casualty events. During a declared
              emergency, you are legally required to follow orders issued by the Mayor of
              New York City, the Governor of New York, or designated emergency management
              officials. This application does not override, supplement, or replace any such
              official order.
            </p>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-1">No Warranties</p>
            <p className="text-muted-foreground">
              This application is provided "as is" without warranty of any kind, express or
              implied. Use of this application is entirely at your own risk.
            </p>
          </div>

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            Disclaimer version 1.0 — Last updated March 2026. The full disclaimer text is
            available at <span className="text-foreground">/disclaimer</span> and in{" "}
            <code className="text-xs bg-muted px-1 rounded">docs/DISCLAIMER.md</code> in the
            source repository.
          </p>
        </div>

        {/* Footer */}
        <div className="flex-none px-6 pt-3 pb-6 border-t border-border space-y-2">
          <button
            onClick={handleAccept}
            className="w-full py-3 px-6 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity text-sm cursor-pointer"
          >
            I Understand &amp; Accept — Continue to App
          </button>
          <p className="text-center text-xs text-muted-foreground">
            By clicking above you confirm you have read and understood this disclaimer.
            Your acceptance is stored locally and you will not be shown this again on this device.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function useDisclaimerAccepted() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}
