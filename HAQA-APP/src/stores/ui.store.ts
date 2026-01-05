import { Store } from '@tanstack/react-store'

export interface UIState {
  mobileMenuOpen: boolean
}

const defaultUIState: UIState = {
  mobileMenuOpen: false,
}

// Create the store
export const uiStore = new Store<UIState>(defaultUIState)

// Helper functions for updating the store
export const uiActions = {
  setMobileMenuOpen: (open: boolean) => {
    uiStore.setState((prev) => ({
      ...prev,
      mobileMenuOpen: open,
    }))
  },
  
  toggleMobileMenu: () => {
    uiStore.setState((prev) => ({
      ...prev,
      mobileMenuOpen: !prev.mobileMenuOpen,
    }))
  },
  
  closeMobileMenu: () => {
    uiStore.setState((prev) => ({
      ...prev,
      mobileMenuOpen: false,
    }))
  },
  
  openMobileMenu: () => {
    uiStore.setState((prev) => ({
      ...prev,
      mobileMenuOpen: true,
    }))
  },
}

