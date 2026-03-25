import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Switch, Route } from "wouter";
import NuclearEscapeRouter from "@/pages/NuclearEscapeRouter";
import DisclaimerPage from "@/pages/DisclaimerPage";
import { DisclaimerModal, DISCLAIMER_STORAGE_KEY } from "@/components/DisclaimerModal";

const queryClient = new QueryClient();

function App() {
  const [accepted, setAccepted] = useState(
    () => localStorage.getItem(DISCLAIMER_STORAGE_KEY) === "true"
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {!accepted && <DisclaimerModal onAccept={() => setAccepted(true)} />}
        {accepted && (
          <Switch>
            <Route path="/disclaimer" component={DisclaimerPage} />
            <Route component={NuclearEscapeRouter} />
          </Switch>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
