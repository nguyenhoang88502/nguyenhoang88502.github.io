from flask import Flask, request, send_file
from flask_cors import CORS
import xlsxwriter
import io

app = Flask(__name__)

# Strictly allow requests only from your GitHub Pages URL to secure your API
CORS(app, resources={r"/api/*": {"origins": "https://nguyenhoang88502.github.io"}})

@app.route('/api/export', methods=['POST'])
def generate_excel():
    # 1. Get the task data sent from your frontend
    req_data = request.json
    tasks = req_data.get('tasks', [])

    # 2. Create an in-memory Excel file (no saving to disk required)
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output, {'in_memory': True})
    
    # 3. Create a worksheet and add formatting
    worksheet = workbook.add_worksheet('Simulation Data')
    bold = workbook.add_format({'bold': True, 'bg_color': '#D9E1F2', 'border': 1})
    
    # Write Headers
    headers = ['Task Name', 'Type', 'Station', 'Time (s)']
    for col_num, header in enumerate(headers):
        worksheet.write(0, col_num, header, bold)

    # Write Data
    for row_num, task in enumerate(tasks, start=1):
        worksheet.write(row_num, 0, task.get('name', 'Task'))
        worksheet.write(row_num, 1, task.get('type', 'VAA'))
        worksheet.write(row_num, 2, task.get('station', 1))
        worksheet.write(row_num, 3, task.get('mean', 0))

    # 4. CREATE A NATIVE EXCEL CHART
    # Create a Column Chart object
    chart = workbook.add_chart({'type': 'column'})

    # Configure the chart to use the data we just wrote (Rows 2 down to the end)
    max_row = len(tasks)
    chart.add_series({
        'name':       'Average Task Time (s)',
        'categories': ['Simulation Data', 1, 0, max_row, 0], # Task Names
        'values':     ['Simulation Data', 1, 3, max_row, 3], # Task Times
        'fill':       {'color': '#3b82f6'},
    })

    # Add chart titles and styling
    chart.set_title({'name': 'Cycle Time by Task'})
    chart.set_x_axis({'name': 'Operations'})
    chart.set_y_axis({'name': 'Time (Seconds)'})
    chart.set_style(11)

    # Insert the chart into the worksheet at cell F2
    worksheet.insert_chart('F2', chart, {'x_offset': 10, 'y_offset': 10})

    # 5. Finalize and return the file
    workbook.close()
    output.seek(0)
    
    return send_file(
        output,
        download_name='Trimmer_Assembly_Report.xlsx',
        as_attachment=True,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )