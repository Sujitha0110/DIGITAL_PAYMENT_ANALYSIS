import re
import os
import json
import pandas as pd
import numpy as np

def parse_sql_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        sql = f.read()

    def parse_values(table_name):
        # Find all occurrences of INSERT INTO table_name (...) VALUES (...);
        matches = re.finditer(r'INSERT INTO ' + table_name + r'\s*\((.*?)\)\s*VALUES\s*(.*?);', sql, re.DOTALL)
        all_rows = []
        columns = []
        for m in matches:
            cols = [c.strip() for c in m.group(1).split(',')]
            if not columns:
                columns = cols
            val_block = m.group(2).strip()
            
            # Parse rows
            # Tokenize by scanning characters
            row = []
            cur_val = []
            in_quote = False
            in_tuple = False
            
            for ch in val_block:
                if ch == "'" and not in_quote:
                    in_quote = True
                elif ch == "'" and in_quote:
                    in_quote = False
                elif ch == '(' and not in_quote and not in_tuple:
                    in_tuple = True
                    row = []
                    cur_val = []
                elif ch == ')' and not in_quote and in_tuple:
                    in_tuple = False
                    row.append(''.join(cur_val).strip().strip("'"))
                    cur_val = []
                    all_rows.append(row)
                elif ch == ',' and in_tuple and not in_quote:
                    row.append(''.join(cur_val).strip().strip("'"))
                    cur_val = []
                elif in_tuple:
                    cur_val.append(ch)
                    
        return pd.DataFrame(all_rows, columns=columns)

    print("Parsing transactions...")
    df_tx = parse_values('transactions')
    print("Parsing payment_retries...")
    df_retries = parse_values('payment_retries')
    print("Parsing refunds_settlements...")
    df_refunds = parse_values('refunds_settlements')
    print("Parsing gateway_settlements...")
    df_settlements = parse_values('gateway_settlements')
    
    return df_tx, df_retries, df_refunds, df_settlements

if __name__ == '__main__':
    df_tx, df_retries, df_refunds, df_settlements = parse_sql_file('digital_payment_analysis_full (1).sql')
    print(f"Transactions: {len(df_tx)} rows, cols: {df_tx.columns.tolist()}")
    print(f"Payment Retries: {len(df_retries)} rows, cols: {df_retries.columns.tolist()}")
    print(f"Refunds: {len(df_refunds)} rows, cols: {df_refunds.columns.tolist()}")
    print(f"Gateway Settlements: {len(df_settlements)} rows, cols: {df_settlements.columns.tolist()}")
