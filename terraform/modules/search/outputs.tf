output "api_url" {
  value = aws_apigatewayv2_api.http.api_endpoint
}

output "api_id" {
  value = aws_apigatewayv2_api.http.id
}

output "stage_name" {
  value = aws_apigatewayv2_stage.default.name
}

output "lambda_name" {
  value = aws_lambda_function.this.function_name
}
