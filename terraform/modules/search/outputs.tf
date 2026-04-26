output "api_url" {
  value = aws_apigatewayv2_api.http.api_endpoint
}

output "lambda_name" {
  value = aws_lambda_function.this.function_name
}

