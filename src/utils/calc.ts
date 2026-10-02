import { CalculationResults, FormData } from '../types';
import { parseFormattedNumber } from './format';

export const getRawData = (data: FormData): Record<string, number> => {
  const num = (value: string) => parseFloat(parseFormattedNumber(value)) || 0;
  return {
    numPassengers: num(data.numPassengers),
    fareValue: num(data.fareValue),
    fixedCommission: num(data.fixedCommission),
    commissionPerPassenger: num(data.commissionPerPassenger),
    fuelExpenses: num(data.fuelExpenses),
    variableExpenses: num(data.variableExpenses),
    administrativeExpenses: num(data.administrativeExpenses),
  };
};

export const calculateResults = (data: FormData): CalculationResults => {
  const { numPassengers, fareValue, fixedCommission, commissionPerPassenger, fuelExpenses, variableExpenses, administrativeExpenses } = getRawData(data);

  const totalRevenue = numPassengers * fareValue;
  const fixedCommissionValue = totalRevenue * (fixedCommission / 100);
  const perPassengerCommissionValue = numPassengers * commissionPerPassenger;
  const driverEarnings = fixedCommissionValue + perPassengerCommissionValue;
  const ownerExpenses = fuelExpenses + variableExpenses;

  return {
    totalRevenue,
    myEarnings: driverEarnings,
    totalExpenses: ownerExpenses + administrativeExpenses,
    amountToSettle: totalRevenue - driverEarnings - ownerExpenses,
    fixedCommissionValue,
    perPassengerCommissionValue,
  };
};
