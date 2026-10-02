import React, { useEffect, useRef, useState } from 'react';

/**
 * Detecta si el teclado del celular está abierto y, cuando se abre, desplaza el campo
 * enfocado para que no quede tapado. `onFocus` guarda cuál es el campo activo.
 */
export const useKeyboardOpen = () => {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const focusedElementRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handleResize = () => {
      const keyboardHeight = window.innerHeight - visualViewport.height;
      const open = keyboardHeight > 80;
      setIsKeyboardOpen(open);

      if (open && focusedElementRef.current) {
        setTimeout(() => {
          const element = focusedElementRef.current;
          if (!element) return;
          if (element.getBoundingClientRect().bottom > visualViewport.height) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 150);
      }
    };

    visualViewport.addEventListener('resize', handleResize);
    handleResize();
    return () => visualViewport.removeEventListener('resize', handleResize);
  }, []);

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedElementRef.current = e.target;
  };

  return { isKeyboardOpen, onFocus };
};
