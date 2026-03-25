import { Link } from "wouter";

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-red-600/20 border border-red-600 flex items-center justify-center">
            <span className="text-xs">☢</span>
          </div>
          <span className="text-sm font-bold">Nuclear Escape Router</span>
        </div>
        <span className="text-muted-foreground text-sm">/</span>
        <span className="text-sm text-muted-foreground">Disclaimer</span>
        <div className="ml-auto">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-accent text-sm font-medium rounded-md transition-colors text-foreground border border-border"
          >
            ← Back to App
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <span>⚠</span> Legal Disclaimer
          </h1>
          <p className="text-muted-foreground text-sm">
            Version 1.0 — Last updated March 2026
          </p>
        </div>

        <div className="rounded-xl border border-yellow-800 bg-yellow-950/30 p-5">
          <p className="font-bold text-yellow-400 text-lg mb-2">
            FOR EDUCATIONAL AND PREPAREDNESS PLANNING ONLY
          </p>
          <p className="text-yellow-200/80 leading-relaxed">
            Nuclear Escape Router is a simulation and educational tool designed for general
            public awareness and emergency preparedness planning. It is not an official
            emergency management system, and is not affiliated with, endorsed by, or operated
            by any government agency, municipal authority, or emergency services organization.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">1. Nature of the Application</h2>
          <p className="text-muted-foreground leading-relaxed">
            This application provides simulated nuclear blast radius visualizations, estimated
            shelter recommendations, and general evacuation guidance for the New York City
            metropolitan area. All outputs are generated using publicly available models,
            simplified algorithms, and third-party data sources. The tool is intended to
            promote general awareness of emergency preparedness concepts — not to serve as
            operational guidance during any actual emergency event.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">2. No Liability for Decisions</h2>
          <p className="text-muted-foreground leading-relaxed">
            The developers, contributors, maintainers, and operators of Nuclear Escape Router
            accept no responsibility or liability — direct, indirect, consequential, or
            otherwise — for any decisions made, actions taken, injuries suffered, loss of life,
            property damage, or any other harm resulting from the use of or reliance on the
            information, recommendations, or outputs provided by this application. Users rely
            on this application entirely at their own risk.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            This application should never be used as the sole or primary source of guidance
            in any emergency situation. Always follow official instructions from qualified
            emergency management authorities.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">3. Third-Party Data — No Accuracy Guarantee</h2>
          <p className="text-muted-foreground leading-relaxed">
            This application integrates data from the following third-party services:
          </p>
          <ul className="space-y-3 ml-4">
            <li className="text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">OpenWeather API</span> — Used
              to retrieve real-time wind speed, wind direction, and atmospheric conditions.
              Weather data may be delayed, incomplete, or inaccurate. Wind-based fallout
              drift modeling is a rough estimate only and is highly sensitive to local
              conditions not captured by the API.
            </li>
            <li className="text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Google Maps Platform</span>{" "}
              (Geocoding API, Directions API) — Used to translate street addresses into
              coordinates and to generate driving routes. Route quality and accuracy depend
              on Google's data, which may not reflect real-time road conditions,
              infrastructure status, or emergency closures.
            </li>
            <li className="text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">OpenStreetMap</span> — Used as
              the base map layer via Leaflet. Map data accuracy varies by area and may not
              be up to date.
            </li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            We make no representations, warranties, or guarantees regarding the accuracy,
            completeness, timeliness, reliability, or suitability of any data provided by
            these third-party services.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">4. Simulated Data and Approximations</h2>
          <p className="text-muted-foreground leading-relaxed">
            Blast radius estimates displayed in this application are based on simplified
            physics models derived from publicly available sources (including declassified
            government publications and academic research). They are not derived from
            classified government sources and are not endorsed by any military, scientific,
            or national security body. Actual effects of any nuclear detonation would depend
            on dozens of highly variable factors including altitude, terrain, atmospheric
            conditions, weapon design, and more.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Shelter information, capacity figures, underground depth ratings, and shelter
            type classifications used in this application are estimates based on publicly
            available information. Actual shelter conditions, availability, accessibility,
            and protective capacity may differ substantially at any given time.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Escape routes generated by this application are algorithmic approximations.
            They do not account for real-time traffic, infrastructure damage, road closures,
            official evacuation orders, bridge or tunnel capacities, or any other dynamic
            factor.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">5. NYC Emergency Law Context</h2>
          <p className="text-muted-foreground leading-relaxed">
            New York City and New York State have established legal frameworks and official
            protocols governing public response to radiological, nuclear, chemical, and
            other mass casualty events. During any declared state of emergency, residents
            may be legally required to follow mandatory evacuation orders, shelter-in-place
            directives, or other lawful instructions issued by:
          </p>
          <ul className="space-y-1 ml-4 text-muted-foreground">
            <li>• The Mayor of the City of New York</li>
            <li>• The Governor of the State of New York</li>
            <li>• NYC Office of Emergency Management (NYC OEM)</li>
            <li>• New York City Police Department (NYPD)</li>
            <li>• New York City Fire Department (FDNY)</li>
            <li>• Federal Emergency Management Agency (FEMA)</li>
            <li>• Any other duly authorized emergency management official</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-2">
            This application does not override, supplement, or replace any such official
            order or directive. Failure to comply with lawful emergency orders may constitute
            a criminal offense under applicable New York State or City law.
          </p>
        </section>

        <div className="rounded-xl border border-red-900 bg-red-950/30 p-5 space-y-3">
          <p className="font-bold text-red-400 text-lg">In a Real Emergency — Official Sources</p>
          <p className="text-red-200/80 leading-relaxed">
            If you are in a real emergency, immediately consult these official sources:
          </p>
          <ul className="space-y-2 text-red-200/80">
            <li className="flex gap-2">
              <span className="flex-none text-red-400 font-bold">•</span>
              <span>
                <strong className="text-red-300">NYC Office of Emergency Management:</strong>{" "}
                nyc.gov/emergency — official shelter locations, evacuation zones, and emergency alerts
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex-none text-red-400 font-bold">•</span>
              <span>
                <strong className="text-red-300">FEMA / Ready.gov:</strong> ready.gov — nuclear
                detonation guidance, shelter-in-place instructions, and federal preparedness resources
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex-none text-red-400 font-bold">•</span>
              <span>
                <strong className="text-red-300">Wireless Emergency Alerts (WEA):</strong> Official
                emergency alerts pushed directly to your mobile phone — do not silence your device
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex-none text-red-400 font-bold">•</span>
              <span>
                <strong className="text-red-300">AM Radio / TV broadcasts:</strong> Tune to local
                news or the Emergency Alert System (EAS) for official instructions
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex-none text-red-400 font-bold">•</span>
              <span>
                <strong className="text-red-300">Call 911</strong> only for life-threatening
                emergencies — emergency lines may be overwhelmed during a mass casualty event
              </span>
            </li>
          </ul>
        </div>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">6. No Warranties</h2>
          <p className="text-muted-foreground leading-relaxed">
            This application is provided "as is" and "as available" without any warranty of
            any kind, express or implied, including but not limited to warranties of
            merchantability, fitness for a particular purpose, or non-infringement. We do not
            warrant that the application will be uninterrupted, error-free, or free of harmful
            components.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-foreground">7. Acceptance</h2>
          <p className="text-muted-foreground leading-relaxed">
            By using this application, you acknowledge that you have read, understood, and
            agreed to this disclaimer in its entirety. If you do not agree to these terms, you
            must not use this application.
          </p>
        </section>

        <div className="border-t border-border pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            ← Back to App
          </Link>
        </div>
      </main>
    </div>
  );
}
